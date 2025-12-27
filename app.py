import os
import json
import re
import uuid
from datetime import datetime
# Añadimos render_template_string para el formulario de acceso rápido
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, render_template_string
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
from google import genai
from google.genai import types
import stripe

# Importamos los prompts optimizados desde tu archivo externo
from prompts import PRODUCT_PROMPTS

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_KEY", "dw_genz_fast_2025")

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# --- CONFIGURACIÓN DE BASE DE DATOS ---
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- CONFIGURACIÓN GEMINI (SDK v1.0+) ---
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

# --- SISTEMA DE CONTROL DE ACCESO ---

@app.route("/acceso", methods=["GET", "POST"])
def acceso_privado():
    """Página simple para pedir el código antes de entrar al creador"""
    error = None
    if request.method == "POST":
        codigo = request.form.get("codigo")
        if codigo == "envoltorio":
            session['autorizado'] = True
            return redirect(url_for('landing'))
        else:
            error = "Código incorrecto. Inténtalo de nuevo."
    
    # HTML simple para el acceso (puedes moverlo a un archivo .html si prefieres)
    return render_template_string('''
        <!DOCTYPE html>
        <html>
        <head>
            <title>Acceso Privado</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { background: #0F172A; color: white; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                form { background: #1E293B; padding: 2rem; border-radius: 1rem; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
                input { padding: 0.5rem; border-radius: 0.5rem; border: none; margin-bottom: 1rem; width: 100%; box-sizing: border-box; }
                button { background: #9333EA; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; width: 100%; }
            </style>
        </head>
        <body>
            <form method="POST">
                <h2>🔐 Área de Pruebas</h2>
                <p>Introduce el código para continuar:</p>
                <input type="password" name="codigo" placeholder="Código secreto..." required autofocus>
                {% if error %}<p style="color: #ef4444;">{{ error }}</p>{% endif %}
                <button type="submit">Entrar</button>
            </form>
        </body>
        </html>
    ''', error=error)

# --- RUTAS DE NAVEGACIÓN ---

@app.route("/")
def landing():
    """Página de inicio"""
    return render_template("landing.html")

@app.route("/start")
def start_creation():
    """Genera un nuevo juego y redirige al creador (PROTEGIDO)"""
    # Verificación de seguridad
    if not session.get('autorizado'):
        return redirect(url_for('acceso_privado'))

    game_id = str(uuid.uuid4())[:8]
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
        session['chat_history'] = []
        
        return redirect(url_for('creator', game_id=game_id))
    
    except Exception as e:
        db.session.rollback()
        print(f"Error al iniciar: {e}")
        return "Error al crear la experiencia.", 500

@app.route("/creator/<game_id>")
def creator(game_id):
    """Carga el editor (PROTEGIDO)"""
    # Verificación de seguridad
    if not session.get('autorizado'):
        return redirect(url_for('acceso_privado'))

    exp = Experience.query.get_or_404(game_id)
    session['current_game_id'] = game_id
    return render_template("creator.html", initial_data=exp.game_data, game_id=game_id)

# --- CORE IA (PROTEGIDO) ---

@app.route("/chat", methods=["POST"])
def chat():
    # Verificación de seguridad también en la API del chat
    if not session.get('autorizado'):
        return jsonify({"reply": "No autorizado"}), 403

    user_message = request.json.get("message")
    current_json = request.json.get("current_json")
    game_id = session.get('current_game_id')
    
    history = session.get('chat_history', [])
    system_instruction = PRODUCT_PROMPTS.get("mini_escape")
    
    context_instruction = f"{system_instruction}\n\nJSON ACTUAL DEL JUEGO:\n{json.dumps(current_json)}"

    gemini_history = []
    for msg in history:
        role = "model" if msg["role"] == "assistant" else "user"
        gemini_history.append(types.Content(role=role, parts=[types.Part.from_text(text=msg["content"])]))

    try:
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

        if "###JSON_DATA###" in reply_text:
            parts = reply_text.split("###JSON_DATA###")
            json_str = re.sub(r'```[a-z]*\n?|```', '', parts[1]).strip()
            
            try:
                new_json_extracted = json.loads(json_str)
                if game_id:
                    exp = Experience.query.get(game_id)
                    if exp:
                        exp.game_data = new_json_extracted
                        db.session.commit()
                
                reply_text = parts[0].strip()
            except json.JSONDecodeError:
                print("Error al parsear el JSON de la IA")

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
        return jsonify({"reply": "Vaya, algo ha fallado en la matriz."}), 500

# --- PERSISTENCIA Y VISTAS DE JUGADOR (Estas las dejamos públicas para que se pueda ver el resultado) ---

@app.route("/save_experience", methods=["POST"])
def save_experience():
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
    exp = Experience.query.get_or_404(game_id)
    return render_template("player.html", 
                         game_data=json.dumps(exp.game_data), 
                         is_demo=True, 
                         game_id=game_id)

@app.route("/experience/<game_id>")
def play_experience(game_id):
    exp = Experience.query.get_or_404(game_id)
    if not exp.is_paid:
        return redirect(url_for('demo_experience', game_id=game_id))
    
    return render_template("player.html", 
                         game_data=json.dumps(exp.game_data), 
                         real_gift=exp.real_gift, 
                         is_demo=False)

@app.route("/pay/<game_id>")
def pay(game_id):
    exp = Experience.query.get_or_404(game_id)
    
    try:
        # Creamos la sesión de Checkout
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'eur',
                    'product_data': {
                        'name': f'Acceso Total: {exp.game_data.get("title", "Tu Experiencia")}',
                    },
                    'unit_amount': 199, # 1.99€ (puedes cambiarlo)
                },
                'quantity': 1,
            }],
            mode='payment',
            # Metadatos: Clave para que el webhook sepa qué juego activar
            metadata={'game_id': game_id},
            success_url=os.getenv("DOMAIN") + url_for('play_experience', game_id=game_id),
            cancel_url=os.getenv("DOMAIN") + url_for('demo_experience', game_id=game_id),
        )
        return redirect(checkout_session.url, code=303)
    except Exception as e:
        print(f"Error al crear sesión: {e}")
        return "Error al procesar el pago.", 500

@app.route("/webhook", methods=["POST"])
def webhook():
    payload = request.get_data()
    sig_header = request.headers.get('STRIPE_SIGNATURE')
    endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
    except Exception as e:
        # Error de validación (firma incorrecta, etc)
        return jsonify(success=False), 400

    # Si el pago se completó correctamente
    if event['type'] == 'checkout.session.completed':
        session_obj = event['data']['object']
        game_id = session_obj.get('metadata', {}).get('game_id')
        
        if game_id:
            # Buscamos la experiencia y la marcamos como pagada
            exp = Experience.query.get(game_id)
            if exp:
                exp.is_paid = True
                db.session.commit()
                print(f"💰 ¡PAGO CONFIRMADO! Juego {game_id} activado.")

    return jsonify(success=True)

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)