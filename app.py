import os
import json
import re
import uuid
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Importamos los prompts optimizados
from prompts import PRODUCT_PROMPTS

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_KEY", "dw_genz_fast_2025")

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
    template_name = db.Column(db.String(50)) 
    game_data = db.Column(db.JSON, nullable=True) 
    real_gift = db.Column(db.Text, nullable=True)
    is_paid = db.Column(db.Boolean, default=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    finalized_at = db.Column(db.DateTime, nullable=True)

# --- RUTAS DE NAVEGACIÓN ---

@app.route("/")
def landing():
    """Landing page enfocada a conversión rápida"""
    return render_template("landing.html")

@app.route("/templates")
def templates_selector():
    """Selección visual de base"""
    return render_template("templates_selector.html")

@app.route("/create/<template_id>")
def initialize_game(template_id):
    """
    Carga inicial silenciosa. 
    Crea el ID y redirige al 'Creator' donde saltará el modal de IA.
    """
    game_id = str(uuid.uuid4())[:8]
    
    template_path = os.path.join(app.root_path, 'static/js/plantillas', f'{template_id}.json')
    
    try:
        # Cargamos la base, pero el usuario no la verá hasta que la IA la procese
        if os.path.exists(template_path):
            with open(template_path, 'r', encoding='utf-8') as f:
                initial_data = json.load(f)
        else:
            # Fallback seguro
            initial_data = {"theme": "theme-default", "steps": []}

        new_experience = Experience(
            id=game_id, 
            template_name=template_id,
            game_data=initial_data
        )
        
        db.session.add(new_experience)
        db.session.commit()
        
        session['current_game_id'] = game_id
        session['chat_history'] = []
        
        return redirect(url_for('creator', game_id=game_id))
    
    except Exception as e:
        db.session.rollback()
        return "Error al iniciar.", 500

@app.route("/creator/<game_id>")
def creator(game_id):
    """
    Punto neurálgico. Ahora no es un editor, es un 'Playtest Room'.
    El frontend decidirá si mostrar el modal de inicio o la demo.
    """
    exp = Experience.query.get_or_404(game_id)
    return render_template("creator.html", initial_data=exp.game_data, game_id=game_id)

# --- CORE IA (MODIFICADO PARA GENERACIÓN FAST) ---

@app.route("/chat", methods=["POST"])
def chat():
    """
    Procesa tanto la 'Gran Idea' inicial como los ajustes posteriores.
    """
    user_message = request.json.get("message")
    current_json = request.json.get("current_json")
    game_id = session.get('current_game_id')
    
    history = session.get('chat_history', [])
    system_instruction = PRODUCT_PROMPTS.get("mini_escape")
    
    # Inyectamos contexto para que la IA actúe como un diseñador invisible
    full_instruction = f"{system_instruction}\n\nJSON ACTUAL:\n{json.dumps(current_json)}"

    history.append({"role": "user", "content": user_message})
    
    gemini_history = []
    for msg in history:
        role_api = "model" if msg["role"] == "assistant" else "user"
        gemini_history.append(types.Content(role=role_api, parts=[types.Part.from_text(text=msg["content"])]))

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=gemini_history,
            config=types.GenerateContentConfig(
                system_instruction=full_instruction, 
                temperature=0.8 # Un poco más de creatividad para Gen Z
            )
        )
        
        reply_text = response.text
        json_clean = None

        if "###JSON_DATA###" in reply_text:
            parts = reply_text.split("###JSON_DATA###")
            json_clean = re.sub(r'```[a-z]*\n?|```', '', parts[1]).strip()
            
            if game_id:
                exp = Experience.query.get(game_id)
                if exp:
                    exp.game_data = json.loads(json_clean)
                    db.session.commit()
            
            reply_text = parts[0].strip() # Solo enviamos el texto narrativo al chat

        history.append({"role": "assistant", "content": reply_text})
        session['chat_history'] = history
        session.modified = True 
        
        return jsonify({
            "reply": reply_text, 
            "new_json": json.loads(json_clean) if json_clean else None
        })
    except Exception as e:
        print(f"IA ERROR: {e}")
        return jsonify({"reply": "¡Ups! Mi chispa creativa se ha apagado un segundo. ¿Me lo repites?"}), 500

# --- PERSISTENCIA Y PAGOS ---

@app.route("/save_experience", methods=["POST"])
def save_experience():
    data = request.json
    game_id = session.get('current_game_id')
    exp = Experience.query.get(game_id)
    
    if exp:
        if 'game_data' in data:
            exp.game_data = data['game_data']
        if 'real_gift' in data:
            exp.real_gift = data['real_gift']
            exp.finalized_at = datetime.utcnow()
        db.session.commit()
        return jsonify({"success": True})
    return jsonify({"success": False}), 404

@app.route("/experience/<game_id>")
def play_experience(game_id):
    """Vista final para el destinatario"""
    exp = Experience.query.get_or_404(game_id)
    if not exp.is_paid:
        # En el nuevo flujo, redirigimos a una vista de "Pago Requerido" o demo
        return render_template("player.html", game_data=json.dumps(exp.game_data), is_demo=True, game_id=game_id)
    
    return render_template("player.html", game_data=json.dumps(exp.game_data), real_gift=exp.real_gift, is_demo=False)

@app.route("/pay/<game_id>")
def simulate_payment(game_id):
    exp = Experience.query.get_or_404(game_id)
    exp.is_paid = True
    db.session.commit()
    return redirect(url_for('play_experience', game_id=game_id))

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)