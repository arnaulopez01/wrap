import os
import json
import re
import uuid
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Asegúrate de tener definidos tus PRODUCT_PROMPTS en prompts.py
from prompts import PRODUCT_PROMPTS

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_KEY", "dw_standard_classic_2025")

# --- CONFIGURACIÓN DE BASE DE DATOS ---
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- GEMINI 2.5 FLASH ---
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL_NAME = "gemini-2.5-flash"

# --- MODELO DE DATOS ---
class Experience(db.Model):
    __tablename__ = 'experiences'
    
    id = db.Column(db.String(8), primary_key=True)
    product_type = db.Column(db.String(20))
    game_data = db.Column(db.JSON, nullable=True) 
    real_gift = db.Column(db.Text, nullable=True)
    is_paid = db.Column(db.Boolean, default=False)
    
    iterations = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    finalized_at = db.Column(db.DateTime, nullable=True)

# --- RUTAS ---

@app.route("/")
def landing():
    return render_template("landing.html")

@app.route("/create")
def creator():
    """Inicializa la experiencia con 1 Portada + 5 Niveles vacíos"""
    game_id = str(uuid.uuid4())[:8]
    
    # Estructura inicial: Portada llena + 5 niveles esperando módulo
    initial_steps = [
        {
            "type": "intro",
            "title": "Titulo de la experiencia",
            "subtitle": "Subtitulo de la experiencia"
        }
    ]
    
    # Niveles sin módulo (aparecerá el recuadro con el +)
    for i in range(1, 6):
        initial_steps.append({
            "type": "level",
            "level_number": i,
            "module": None,  # Esto activa el estado vacío en creator.js
            "level_title": f"Nivel {i}",
            "question": "",
            "answer": ""
        })

    default_data = {
        "title": "Mi Experiencia Digital",
        "steps": initial_steps
    }
    
    new_draft = Experience(
        id=game_id, 
        product_type="quiz",
        game_data=default_data
    )
    
    try:
        db.session.add(new_draft)
        db.session.commit()
        
        session['current_game_id'] = game_id
        session['chat_history'] = []
        
        # Inyectamos initial_data para carga instantánea
        return render_template("creator.html", initial_data=default_data, game_id=game_id)
    except Exception as e:
        db.session.rollback()
        print(f"DEBUG DB ERROR: {e}")
        return "Error al inicializar la base de datos.", 500

@app.route("/chat", methods=["POST"])
def chat():
    user_message = request.json.get("message")
    product_type = request.json.get("product_type", "quiz")
    current_json = request.json.get("current_json")
    game_id = session.get('current_game_id')
    
    history = session.get('chat_history', [])
    
    # PROMPT DE COHERENCIA CON MÓDULOS
    base_instruction = PRODUCT_PROMPTS.get(product_type, PRODUCT_PROMPTS["quiz"])
    system_instruction = f"""
    {base_instruction}
    
    JSON ACTUAL DEL EDITOR:
    {json.dumps(current_json)}
    
    INSTRUCCIONES CRÍTICAS:
    1. Eres un experto en gamificación.
    2. Si el usuario pide una temática, rellena los campos 'title', 'subtitle', 'level_title', 'question' y 'answer' de los niveles.
    3. Si un nivel tiene 'module': null, tú puedes proponer uno (ej: 'quiz' o 'adivinanza') asignando el valor al campo 'module' y rellenando su contenido.
    4. NO cambies la estructura de 6 pasos.
    5. Respeta los textos que el usuario haya escrito manualmente.
    6. Devuelve el JSON completo tras la etiqueta ###JSON_DATA###.
    7. No menciones la palabra JSON al usuario, interactua normal con él.
    8. Intenta que las respuestas sean de una palabra.
    """

    history.append({"role": "user", "content": user_message})
    
    gemini_history = []
    for msg in history:
        role_api = "model" if msg["role"] == "assistant" else "user"
        gemini_history.append(types.Content(role=role_api, parts=[types.Part.from_text(text=msg["content"])]))

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=gemini_history,
            config=types.GenerateContentConfig(system_instruction=system_instruction, temperature=0.7)
        )
        
        full_text = response.text
        if "###JSON_DATA###" in full_text:
            parts = full_text.split("###JSON_DATA###")
            json_clean = re.sub(r'```[a-z]*\n?|```', '', parts[1]).strip()
            
            # Guardado automático de la propuesta de la IA en DB
            if game_id:
                exp = Experience.query.get(game_id)
                if exp:
                    exp.game_data = json.loads(json_clean)
                    exp.iterations += 1
                    db.session.commit()
            
            full_text = f"{parts[0]}###JSON_DATA###{json_clean}"

        history.append({"role": "assistant", "content": full_text})
        session['chat_history'] = history
        session.modified = True 
        return jsonify({"reply": full_text})
    except Exception as e:
        print(f"GEMINI ERROR: {e}")
        return jsonify({"reply": "Lo siento, tuve un problema procesando tu idea."}), 500

@app.route("/save_experience", methods=["POST"])
def save_experience():
    data = request.json
    game_id = session.get('current_game_id')
    exp = Experience.query.get(game_id)
    if exp:
        # Actualización de datos del juego (Manual o Auto-save)
        if 'game_data' in data:
            exp.game_data = data['game_data']
        
        # Guardado final (Cuando pulsa Finalizar)
        if 'real_gift' in data:
            exp.real_gift = data['real_gift']
            exp.finalized_at = datetime.utcnow()
            
        db.session.commit()
        return jsonify({"success": True})
    return jsonify({"success": False}), 404

@app.route("/experience/<game_id>")
def play_experience(game_id):
    exp = Experience.query.get(game_id)
    if not exp or not exp.finalized_at:
        return "Esta experiencia aún no está lista o no existe.", 404
    
    return render_template("player.html", 
                           game_data=json.dumps(exp.game_data), 
                           real_gift=exp.real_gift)

if __name__ == "__main__":
    app.run(debug=True, port=5000)