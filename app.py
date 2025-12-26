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
    template_name = db.Column(db.String(50), default='theme-default') 
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

@app.route("/start")
def start_creation():
    """
    NUEVA RUTA: Punto de entrada único.
    Crea el ID de juego y redirige al creador directamente.
    Ya no pedimos plantilla aquí.
    """
    game_id = str(uuid.uuid4())[:8]
    
    # Inicializamos con un JSON base vacío pero estructurado
    initial_data = {
        "theme": "theme-default",
        "title": "Nueva Experiencia",
        "steps": []
    }

    try:
        new_experience = Experience(
            id=game_id, 
            template_name='theme-default',
            game_data=initial_data
        )
        
        db.session.add(new_experience)
        db.session.commit()
        
        session['current_game_id'] = game_id
        session['chat_history'] = []
        
        return redirect(url_for('creator', game_id=game_id))
    
    except Exception as e:
        db.session.rollback()
        print(f"Error al iniciar: {e}")
        return "Error al iniciar la experiencia.", 500

@app.route("/creator/<game_id>")
def creator(game_id):
    """
    Carga el creador. El JS detectará que 'steps' está vacío
    y mostrará la nueva pantalla de 'Elige tu aventura'.
    """
    exp = Experience.query.get_or_404(game_id)
    return render_template("creator.html", initial_data=exp.game_data, game_id=game_id)

# --- CORE IA (SOPORTE PARA IDEAS Y PRESETS) ---

@app.route("/chat", methods=["POST"])
def chat():
    user_message = request.json.get("message")
    current_json = request.json.get("current_json")
    game_id = session.get('current_game_id')
    
    history = session.get('chat_history', [])
    system_instruction = PRODUCT_PROMPTS.get("mini_escape")
    
    # Inyectamos contexto
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
                temperature=0.8
            )
        )
        
        reply_text = response.text
        json_clean = None

        if "###JSON_DATA###" in reply_text:
            parts = reply_text.split("###JSON_DATA###")
            json_clean = re.sub(r'```[a-z]*\n?|```', '', parts[1]).strip()
            
            new_data = json.loads(json_clean)
            
            if game_id:
                exp = Experience.query.get(game_id)
                if exp:
                    exp.game_data = new_data
                    # Si la IA sugiere un tema nuevo en el JSON, lo actualizamos en el modelo
                    if 'theme' in new_data:
                        exp.template_name = new_data['theme']
                    db.session.commit()
            
            reply_text = parts[0].strip()

        history.append({"role": "assistant", "content": reply_text})
        session['chat_history'] = history
        session.modified = True 
        
        return jsonify({
            "reply": reply_text, 
            "new_json": json.loads(json_clean) if json_clean else None
        })
    except Exception as e:
        print(f"IA ERROR: {e}")
        return jsonify({"reply": "Error en la generación."}), 500

# --- PERSISTENCIA Y VISTAS FINALES ---

@app.route("/save_experience", methods=["POST"])
def save_experience():
    data = request.json
    game_id = session.get('current_game_id')
    exp = Experience.query.get(game_id)
    
    if exp:
        if 'game_data' in data:
            exp.game_data = data['game_data']
            if 'theme' in data['game_data']:
                exp.template_name = data['game_data']['theme']
        if 'real_gift' in data:
            exp.real_gift = data['real_gift']
            exp.finalized_at = datetime.utcnow()
        db.session.commit()
        return jsonify({"success": True})
    return jsonify({"success": False}), 404

@app.route("/demo/<game_id>")
def demo_experience(game_id):
    """Vista de previsualización final antes del pago"""
    exp = Experience.query.get_or_404(game_id)
    return render_template("player.html", game_data=json.dumps(exp.game_data), is_demo=True, game_id=game_id)

@app.route("/experience/<game_id>")
def play_experience(game_id):
    """Vista real del regalo (solo si está pagado)"""
    exp = Experience.query.get_or_404(game_id)
    if not exp.is_paid:
        return redirect(url_for('demo_experience', game_id=game_id))
    
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