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

# Importamos solo el mapeo necesario de prompts.py
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

# --- MODELO DE DATOS MVP ---
class Experience(db.Model):
    __tablename__ = 'experiences'
    
    id = db.Column(db.String(8), primary_key=True)
    template_name = db.Column(db.String(50)) # Ejemplo: 'san_valentin', 'hacker'
    game_data = db.Column(db.JSON, nullable=True) 
    real_gift = db.Column(db.Text, nullable=True)
    is_paid = db.Column(db.Boolean, default=False) # Diferencia Demo de Final
    
    iterations = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    finalized_at = db.Column(db.DateTime, nullable=True)

# --- RUTAS DE NAVEGACIÓN ---

@app.route("/")
def landing():
    """Página de inicio con los dos modos: Mini Escape y Premium (próximamente)"""
    return render_template("landing.html")

@app.route("/templates")
def templates_selector():
    """El usuario elige una temática antes de entrar al editor"""
    return render_template("templates_selector.html")

@app.route("/create/<template_id>")
def initialize_game(template_id):
    """Carga la plantilla JSON y crea el registro en la DB"""
    game_id = str(uuid.uuid4())[:8]
    
    # Buscamos el archivo JSON de la plantilla elegida
    template_path = os.path.join(app.root_path, 'static/js/plantillas', f'{template_id}.json')
    
    try:
        if os.path.exists(template_path):
            with open(template_path, 'r', encoding='utf-8') as f:
                initial_data = json.load(f)
        else:
            # Plantilla por defecto si no existe la específica
            initial_data = {
                "title": "Nueva Aventura",
                "steps": [{"type": "intro", "title": "Bienvenido", "subtitle": "Tu aventura comienza ahora"}] + 
                         [{"type": "level", "level_number": i, "level_title": f"Reto {i}", "question": "Pregunta...", "answer": "Respuesta"} for i in range(1,6)]
            }

        new_experience = Experience(
            id=game_id, 
            template_name=template_id,
            game_data=initial_data
        )
        
        db.session.add(new_experience)
        db.session.commit()
        
        # Guardamos en sesión para el editor
        session['current_game_id'] = game_id
        session['chat_history'] = []
        
        return redirect(url_for('creator', game_id=game_id))
    
    except Exception as e:
        db.session.rollback()
        print(f"ERROR INIT: {e}")
        return "Error al crear la experiencia.", 500

@app.route("/creator/<game_id>")
def creator(game_id):
    """Editor con IA y vista previa"""
    exp = Experience.query.get_or_404(game_id)
    return render_template("creator.html", initial_data=exp.game_data, game_id=game_id)

# --- RUTAS DE JUEGO ---

@app.route("/demo/<game_id>")
def play_demo(game_id):
    """Demo jugable: Con marca de agua y regalo bloqueado"""
    exp = Experience.query.get_or_404(game_id)
    return render_template("player.html", 
                           game_data=json.dumps(exp.game_data), 
                           real_gift=exp.real_gift,
                           is_demo=True)

@app.route("/experience/<game_id>")
def play_experience(game_id):
    """Experiencia final: Sin marca de agua y regalo visible (Solo si is_paid=True)"""
    exp = Experience.query.get_or_404(game_id)
    
    if not exp.is_paid:
        return redirect(url_for('play_demo', game_id=game_id))
    
    return render_template("player.html", 
                           game_data=json.dumps(exp.game_data), 
                           real_gift=exp.real_gift,
                           is_demo=False)

# --- CORE IA Y PERSISTENCIA ---

@app.route("/chat", methods=["POST"])
def chat():
    """Interacción con Gemini para personalizar la plantilla"""
    user_message = request.json.get("message")
    current_json = request.json.get("current_json")
    game_id = session.get('current_game_id')
    
    history = session.get('chat_history', [])
    
    # Usamos siempre el prompt de mini_escape para el MVP
    system_instruction = PRODUCT_PROMPTS.get("mini_escape")
    
    # Inyectamos el JSON actual para que la IA sepa qué está editando
    full_instruction = f"{system_instruction}\n\nJSON ACTUAL A EDITAR:\n{json.dumps(current_json)}"

    history.append({"role": "user", "content": user_message})
    
    gemini_history = []
    for msg in history:
        role_api = "model" if msg["role"] == "assistant" else "user"
        gemini_history.append(types.Content(role=role_api, parts=[types.Part.from_text(text=msg["content"])]))

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=gemini_history,
            config=types.GenerateContentConfig(system_instruction=full_instruction, temperature=0.7)
        )
        
        reply_text = response.text
        if "###JSON_DATA###" in reply_text:
            parts = reply_text.split("###JSON_DATA###")
            json_clean = re.sub(r'```[a-z]*\n?|```', '', parts[1]).strip()
            
            # Guardado automático en DB al recibir cambios de la IA
            if game_id:
                exp = Experience.query.get(game_id)
                if exp:
                    exp.game_data = json.loads(json_clean)
                    db.session.commit()
            
            reply_text = f"{parts[0]}###JSON_DATA###{json_clean}"

        history.append({"role": "assistant", "content": reply_text})
        session['chat_history'] = history
        session.modified = True 
        return jsonify({"reply": reply_text})
    except Exception as e:
        print(f"GEMINI ERROR: {e}")
        return jsonify({"reply": "Lo siento, ¿podrías repetirme esa idea?"}), 500

@app.route("/save_experience", methods=["POST"])
def save_experience():
    """Guardado manual o cuando el usuario edita directamente en el preview"""
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

# --- PASARELA DE PAGO SIMULADA ---

@app.route("/pay/<game_id>")
def simulate_payment(game_id):
    """Ruta temporal para activar la experiencia tras el pago"""
    exp = Experience.query.get_or_404(game_id)
    exp.is_paid = True
    db.session.commit()
    return redirect(url_for('play_experience', game_id=game_id))

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)