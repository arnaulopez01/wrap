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

# Importamos los prompts optimizados desde tu archivo externo
from prompts import PRODUCT_PROMPTS

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_KEY", "dw_genz_fast_2025")

# --- CONFIGURACIÓN DE BASE DE DATOS ---
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- CONFIGURACIÓN GEMINI (SDK v1.0+) ---
# Usamos el nombre del modelo especificado por el usuario
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
    """Página de inicio"""
    return render_template("landing.html")

@app.route("/start")
def start_creation():
    """Genera un nuevo juego y redirige al creador"""
    game_id = str(uuid.uuid4())[:8]
    
    # Estructura base para el nuevo juego
    initial_data = {
        "visual_config": {
            "primary_color": "#9333EA",
            "bg_color": "#0F172A",
            "font_family": "Montserrat",
            "theme_icon": "fa-wand-magic-sparkles"
        },
        "title": "Nueva Experiencia",
        "steps": []
    }

    try:
        new_experience = Experience(
            id=game_id, 
            game_data=initial_data
        )
        db.session.add(new_experience)
        db.session.commit()
        
        session['current_game_id'] = game_id
        session['chat_history'] = [] # Reiniciamos historial para nueva sesión
        
        return redirect(url_for('creator', game_id=game_id))
    
    except Exception as e:
        db.session.rollback()
        print(f"Error al iniciar: {e}")
        return "Error al crear la experiencia.", 500

@app.route("/creator/<game_id>")
def creator(game_id):
    """Carga el editor con los datos actuales de la DB"""
    exp = Experience.query.get_or_404(game_id)
    # Guardamos en sesión por si acaso el ID cambia en navegación
    session['current_game_id'] = game_id
    return render_template("creator.html", initial_data=exp.game_data, game_id=game_id)

# --- CORE IA (SOPORTE PARA GENERACIÓN Y AJUSTES) ---

@app.route("/chat", methods=["POST"])
def chat():
    user_message = request.json.get("message")
    current_json = request.json.get("current_json")
    game_id = session.get('current_game_id')
    
    # Recuperamos o inicializamos el historial de la sesión
    history = session.get('chat_history', [])
    system_instruction = PRODUCT_PROMPTS.get("mini_escape")
    
    # Inyectamos el JSON actual como contexto para que Gemini sepa qué modificar
    context_instruction = f"{system_instruction}\n\nJSON ACTUAL DEL JUEGO (Usa esto como base):\n{json.dumps(current_json)}"

    # Preparamos el historial para el SDK de Gemini
    gemini_history = []
    for msg in history:
        role = "model" if msg["role"] == "assistant" else "user"
        gemini_history.append(types.Content(role=role, parts=[types.Part.from_text(text=msg["content"])]))

    try:
        # Llamada a la IA
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=gemini_history + [types.Content(role="user", parts=[types.Part.from_text(text=user_message)])],
            config=types.GenerateContentConfig(
                system_instruction=context_instruction, 
                temperature=0.7
            )
        )
        
        reply_text = response.text
        new_json_extracted = None

        # Procesamiento de la respuesta (Texto + Delimitador + JSON)
        if "###JSON_DATA###" in reply_text:
            parts = reply_text.split("###JSON_DATA###")
            # Limpiamos posibles backticks de markdown
            json_str = re.sub(r'```[a-z]*\n?|```', '', parts[1]).strip()
            
            try:
                new_json_extracted = json.loads(json_str)
                
                # Sincronizamos con la Base de Datos inmediatamente
                if game_id:
                    exp = Experience.query.get(game_id)
                    if exp:
                        exp.game_data = new_json_extracted
                        db.session.commit()
                
                reply_text = parts[0].strip() # Dejamos solo el mensaje motivador para el chat
            except json.JSONDecodeError:
                print("Error al parsear el JSON de la IA")

        # Actualizamos historial de sesión
        history.append({"role": "user", "content": user_message})
        history.append({"role": "assistant", "content": reply_text})
        session['chat_history'] = history
        session.modified = True 
        
        return jsonify({
            "reply": reply_text, 
            "new_json": new_json_extracted
        })

    except Exception as e:
        print(f"IA ERROR: {e}")
        return jsonify({"reply": "Vaya, algo ha fallado en la matriz. Inténtalo de nuevo."}), 500

# --- PERSISTENCIA Y VISTAS DE JUGADOR ---

@app.route("/save_experience", methods=["POST"])
def save_experience():
    """Ruta para guardado silencioso o finalización"""
    data = request.json
    game_id = session.get('current_game_id') or data.get('game_id')
    
    exp = Experience.query.get(game_id)
    if not exp:
        return jsonify({"success": False}), 404
    
    if 'game_data' in data:
        exp.game_data = data['game_data']
    
    if 'real_gift' in data:
        exp.real_gift = data['real_gift']
        exp.finalized_at = datetime.utcnow()
    
    db.session.commit()
    return jsonify({"success": True})

@app.route("/demo/<game_id>")
def demo_experience(game_id):
    """Vista previa del jugador (con marca de agua)"""
    exp = Experience.query.get_or_404(game_id)
    return render_template("player.html", 
                         game_data=json.dumps(exp.game_data), 
                         is_demo=True, 
                         game_id=game_id)

@app.route("/experience/<game_id>")
def play_experience(game_id):
    """Vista final para el destinatario (solo si pagó)"""
    exp = Experience.query.get_or_404(game_id)
    if not exp.is_paid:
        return redirect(url_for('demo_experience', game_id=game_id))
    
    return render_template("player.html", 
                         game_data=json.dumps(exp.game_data), 
                         real_gift=exp.real_gift, 
                         is_demo=False)

@app.route("/pay/<game_id>")
def simulate_payment(game_id):
    """Simulador de pasarela de pago"""
    exp = Experience.query.get_or_404(game_id)
    exp.is_paid = True
    db.session.commit()
    return redirect(url_for('play_experience', game_id=game_id))

if __name__ == "__main__":
    with app.app_context():
        db.create_all() # Crea las tablas si no existen
    app.run(debug=True, port=5000)