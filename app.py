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

# Importamos los prompts
from prompts import PRODUCT_PROMPTS

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_KEY", "dw_standard_classic_2025")

# --- CONFIGURACIÓN DE BASE DE DATOS (PSYCOG2) ---
# SQLAlchemy detectará automáticamente el driver psycopg2 con la URL estándar
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
    
    # Analítica
    iterations = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    finalized_at = db.Column(db.DateTime, nullable=True)

# --- RUTAS ---

@app.route("/")
def landing():
    return render_template("landing.html")

@app.route("/create")
def creator():
    """Inicializa la experiencia en la DB"""
    game_id = str(uuid.uuid4())[:8]
    
    # Creamos el borrador
    new_draft = Experience(
        id=game_id, 
        product_type="pendiente"
    )
    
    try:
        db.session.add(new_draft)
        db.session.commit() # Si el puerto 5433 está abierto, esto DEBE funcionar con psycopg2
        
        session['current_game_id'] = game_id
        session['chat_history'] = []
        return render_template("creator.html")
    except Exception as e:
        db.session.rollback()
        # Imprimimos el error real en la consola para depurar
        print(f"DEBUG ERROR DB: {e}")
        return f"Error de conexión a la base de datos local.", 500

@app.route("/chat", methods=["POST"])
def chat():
    user_message = request.json.get("message")
    product_type = request.json.get("product_type", "quiz")
    game_id = session.get('current_game_id')
    
    history = session.get('chat_history', [])
    system_instruction = PRODUCT_PROMPTS.get(product_type, PRODUCT_PROMPTS["quiz"])
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
            full_text = f"{parts[0]}###JSON_DATA###{json_clean}"

        # Sumar iteración en DB
        if game_id:
            exp = Experience.query.get(game_id)
            if exp:
                exp.iterations += 1
                db.session.commit()

        history.append({"role": "assistant", "content": full_text})
        session['chat_history'] = history
        session.modified = True 
        return jsonify({"reply": full_text})
    except Exception as e:
        return jsonify({"reply": "Error con la IA."}), 500

@app.route("/save_experience", methods=["POST"])
def save_experience():
    data = request.json
    game_id = session.get('current_game_id')
    exp = Experience.query.get(game_id)
    if exp:
        exp.game_data = data['game_data']
        exp.real_gift = data['real_gift']
        exp.finalized_at = datetime.utcnow()
        db.session.commit()
        return jsonify({"success": True, "game_id": game_id})
    return jsonify({"success": False}), 404

@app.route("/experience/<game_id>")
def play_experience(game_id):
    exp = Experience.query.get(game_id)
    if not exp or not exp.finalized_at:
        return "No encontrado", 404
    return render_template("player.html", game_data=json.dumps(exp.game_data), real_gift=exp.real_gift)

if __name__ == "__main__":
    app.run(debug=True, port=5000)