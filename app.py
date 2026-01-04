# ==========================================================================
# SECCIÓN 1: IMPORTACIONES Y CONFIGURACIÓN INICIAL
# ==========================================================================
import os
import json
import re
import uuid
import base64
from io import BytesIO
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, render_template_string
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
from google import genai
from google.genai import types
import stripe

# Librerías para QR y Email (SendGrid)
import qrcode
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition

# Importación de prompts externos
from prompts import PRODUCT_PROMPTS

# Inicialización de entorno y aplicación
load_dotenv()
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_KEY", "dw_genz_fast_2025")

# Configuración de servicios de terceros
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# ==========================================================================
# SECCIÓN 2: CONFIGURACIÓN DE BASE DE DATOS Y MODELOS
# ==========================================================================
# Asegúrate de que DATABASE_URL empieza por postgresql:// y no postgres:// (fix para Render)
db_url = os.getenv('DATABASE_URL')
if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class Experience(db.Model):
    """
    Representa la entidad de una experiencia de juego en la base de datos.
    """
    __tablename__ = 'experiences'
    
    id = db.Column(db.String(8), primary_key=True)
    template_name = db.Column(db.String(50), default='theme-default') 
    game_data = db.Column(db.JSON, nullable=True) 
    real_gift = db.Column(db.Text, nullable=True)
    is_paid = db.Column(db.Boolean, default=False)
    
    # Campo nuevo para guardar el email del cliente y dar soporte si hace falta
    customer_email = db.Column(db.String(120), nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    finalized_at = db.Column(db.DateTime, nullable=True)

# ==========================================================================
# SECCIÓN 3: HELPERS (IA, QR Y EMAIL)
# ==========================================================================
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL_NAME = "gemini-2.5-flash" 

def generate_qr_base64(url):
    """Genera un código QR y lo devuelve como string base64 para embeber en HTML/Email."""
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")

def send_delivery_email(to_email, game_url, qr_b64, answers, game_title):
    """Envía el email transaccional usando SendGrid (Opción A)."""
    if not os.getenv("SENDGRID_API_KEY"):
        print("⚠️ SendGrid API Key no configurada. Email no enviado.")
        return

    # Plantilla HTML del correo
    html_content = f"""
    <div style="font-family: 'Helvetica', sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; line-height: 1.6;">
        <h1 style="color: #9333EA; text-align: center;">¡Tu regalo está listo! 🎁</h1>
        <p>Gracias por usar Digital Wrap. Aquí tienes el acceso a la experiencia <strong>"{game_title}"</strong>.</p>
        
        <div style="background: #f3f4f6; padding: 25px; border-radius: 15px; margin: 20px 0; text-align: center;">
            <p style="font-weight: bold; margin-bottom: 15px;">🔗 Enlace Único</p>
            <a href="{game_url}" style="display: inline-block; background: #9333EA; color: white; padding: 12px 25px; text-decoration: none; border-radius: 50px; font-weight: bold;">Abrir Experiencia</a>
            <p style="font-size: 12px; color: #666; margin-top: 15px; word-break: break-all;">{game_url}</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
            <p style="font-weight: bold;">📱 Código QR (Para imprimir o enseñar)</p>
            <img src="cid:qrcode_img" alt="QR Code" style="width: 160px; border: 4px solid #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-radius: 10px;">
        </div>

        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
        
        <div style="background: #111; color: #4ade80; padding: 20px; border-radius: 10px; font-family: monospace; font-size: 14px;">
            <h3 style="margin-top: 0; color: white; border-bottom: 1px solid #333; padding-bottom: 10px;">🕵️ Hoja de Respuestas (Confidencial)</h3>
            <pre style="white-space: pre-wrap; margin: 0;">{answers}</pre>
        </div>
        
        <p style="font-size: 12px; color: #999; margin-top: 30px; text-align: center;">
            ¿Necesitas ayuda? Responde a este correo.<br>
            Digital Wrap © 2025
        </p>
    </div>
    """

    message = Mail(
        from_email=os.getenv("FROM_EMAIL"),
        to_emails=to_email,
        subject=f'🎁 Tu Digital Wrap: {game_title}',
        html_content=html_content
    )

    # Adjuntar QR como imagen embebida (inline)
    attachment = Attachment(
        FileContent(qr_b64),
        FileName('qrcode.png'),
        FileType('image/png'),
        Disposition('inline'),
        content_id='qrcode_img' 
    )
    message.attachment = attachment

    try:
        sg = SendGridAPIClient(os.getenv("SENDGRID_API_KEY"))
        response = sg.send(message)
        print(f"📧 Email enviado correctamente a {to_email}. Status: {response.status_code}")
    except Exception as e:
        print(f"❌ Error crítico enviando email: {e}")

# ==========================================================================
# SECCIÓN 4: ACCESO, RECUPERACIÓN Y CREACIÓN
# ==========================================================================
@app.route("/acceso", methods=["GET", "POST"])
def acceso_privado():
    error = None
    if request.method == "POST":
        codigo = request.form.get("codigo")
        if codigo == "envoltorio":
            session['autorizado'] = True
            return redirect(url_for('landing'))
        else:
            error = "Código incorrecto."
    
    # (Mantenemos tu template simple inline)
    return render_template_string('''
        <!DOCTYPE html><html><head><title>Acceso</title><meta name="viewport" content="width=device-width, initial-scale=1">
        <style>body{background:#0F172A;color:white;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}form{background:#1E293B;padding:2rem;border-radius:1rem;text-align:center}input{padding:.5rem;width:100%;margin-bottom:1rem}button{background:#9333EA;color:white;border:none;padding:.5rem 1rem;width:100%;cursor:pointer}</style>
        </head><body><form method="POST"><h2>🔐 Área Privada</h2><input type="password" name="codigo" required><button>Entrar</button>{% if error %}<p style="color:red">{{ error }}</p>{% endif %}</form></body></html>
    ''', error=error)

@app.route("/")
def landing():
    return render_template("landing.html")

# NUEVO: Endpoint para recuperar sesión desde landing.js
@app.route("/api/recover/<game_id>")
def recover_game(game_id):
    """Verifica si un juego existe y se puede recuperar."""
    exp = Experience.query.get(game_id)
    if exp and not exp.is_paid:
        title = exp.game_data.get("title", "Juego sin título") if exp.game_data else "Tu Experiencia"
        return jsonify({"exists": True, "title": title})
    return jsonify({"exists": False})

@app.route("/start")
def start_creation():
    if not session.get('autorizado'): return redirect(url_for('acceso_privado'))

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
        new_experience = Experience(id=game_id, game_data=initial_data)
        db.session.add(new_experience)
        db.session.commit()
        
        session['current_game_id'] = game_id
        session['chat_history'] = []
        return redirect(url_for('creator', game_id=game_id))
    except Exception as e:
        db.session.rollback()
        return "Error creando base de datos", 500

@app.route("/creator/<game_id>")
def creator(game_id):
    if not session.get('autorizado'): return redirect(url_for('acceso_privado'))

    exp = Experience.query.get_or_404(game_id)
    
    # SEGURIDAD: Si ya pagó, no dejar editar. Mandar a la entrega.
    if exp.is_paid:
        return redirect(url_for('share_game', game_id=game_id))

    session['current_game_id'] = game_id
    return render_template("creator.html", initial_data=exp.game_data, game_id=game_id)

# ==========================================================================
# SECCIÓN 5: LÓGICA CORE DE IA (CHAT) Y GUARDADO
# ==========================================================================
@app.route("/chat", methods=["POST"])
def chat():
    if not session.get('autorizado'): return jsonify({"reply": "No auth"}), 403

    user_message = request.json.get("message")
    current_json = request.json.get("current_json")
    game_id = session.get('current_game_id')
    history = session.get('chat_history', [])
    
    system_instruction = PRODUCT_PROMPTS.get("mini_escape")
    context_instruction = f"{system_instruction}\n\nJSON ACTUAL:\n{json.dumps(current_json)}"

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
            except: pass

        history.append({"role": "user", "content": user_message})
        history.append({"role": "assistant", "content": reply_text})
        session['chat_history'] = history
        session.modified = True 
        
        return jsonify({"reply": reply_text, "new_json": new_json_extracted})

    except Exception as e:
        print(f"IA ERROR: {e}")
        return jsonify({"reply": "Error de conexión con la IA."}), 500

@app.route("/save_experience", methods=["POST"])
def save_experience():
    data = request.json
    game_id = session.get('current_game_id') or data.get('game_id')
    exp = Experience.query.get(game_id)
    
    if not exp: return jsonify({"success": False}), 404
    
    if 'game_data' in data: exp.game_data = data['game_data']
    if 'real_gift' in data: 
        exp.real_gift = data['real_gift']
        exp.finalized_at = datetime.utcnow()
    
    db.session.commit()
    return jsonify({"success": True})

# ==========================================================================
# SECCIÓN 6: PAGO, WEBHOOK Y ENTREGA (CRÍTICO)
# ==========================================================================

# 1. Endpoint ligero para que share.html pregunte si ya se pagó
@app.route("/check_payment_status/<game_id>")
def check_payment_status(game_id):
    exp = Experience.query.get(game_id)
    return jsonify({"paid": exp.is_paid if exp else False})

# 2. Sala de Espera / Entrega de Producto
@app.route("/share/<game_id>")
def share_game(game_id):
    exp = Experience.query.get_or_404(game_id)
    
    # Construimos enlace absoluto
    domain = os.getenv("DOMAIN", "http://localhost:5000")
    final_link = f"{domain}{url_for('play_experience', game_id=game_id)}"
    
    qr_b64 = None
    if exp.is_paid:
        # Generamos el QR al vuelo solo si ya está pagado
        qr_b64 = generate_qr_base64(final_link)
    
    return render_template("share.html", 
                           game=exp, 
                           game_link=final_link, 
                           qr_code=qr_b64, 
                           is_paid=exp.is_paid)

# 3. Creación de Checkout de Stripe
@app.route("/pay/<game_id>")
def pay(game_id):
    exp = Experience.query.get_or_404(game_id)
    domain = os.getenv("DOMAIN", "http://localhost:5000")
    
    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            customer_email=None, # Stripe se encarga de pedirlo en el formulario
            line_items=[{
                'price_data': {
                    'currency': 'eur',
                    'product_data': {
                        'name': f'Digital Wrap: {exp.game_data.get("title", "Regalo")}',
                        'description': 'Experiencia completa + QR + Enlace único',
                    },
                    'unit_amount': 249, # 2.49 EUR
                },
                'quantity': 1,
            }],
            mode='payment',
            metadata={'game_id': game_id},
            
            # REDIRECCIONES CLAVE
            success_url=f"{domain}{url_for('share_game', game_id=game_id)}",
            cancel_url=f"{domain}{url_for('demo_experience', game_id=game_id)}",
        )
        return redirect(checkout_session.url, code=303)
    except Exception as e:
        print(f"Stripe Error: {e}")
        return "Error al iniciar pago.", 500

# 4. Webhook: Donde ocurre la magia (Confirmación + Email)
@app.route("/webhook", methods=["POST"])
def webhook():
    payload = request.get_data()
    sig_header = request.headers.get('STRIPE_SIGNATURE')
    endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    except Exception as e:
        return jsonify(success=False), 400

    if event['type'] == 'checkout.session.completed':
        session_obj = event['data']['object']
        game_id = session_obj.get('metadata', {}).get('game_id')
        customer_email = session_obj.get('customer_details', {}).get('email')
        
        if game_id:
            exp = Experience.query.get(game_id)
            if exp and not exp.is_paid:
                # A. Actualizar Base de Datos
                exp.is_paid = True
                exp.customer_email = customer_email
                db.session.commit()
                print(f"💰 PAGO OK: {game_id} | Email: {customer_email}")

                # B. Preparar Datos para Email
                domain = os.getenv("DOMAIN", "http://localhost:5000")
                final_link = f"{domain}{url_for('play_experience', game_id=game_id)}"
                qr_b64 = generate_qr_base64(final_link)
                title = exp.game_data.get("title", "Tu Experiencia")
                
                # C. Extraer respuestas (Parsing seguro)
                answers_text = ""
                try:
                    steps = exp.game_data.get('steps', [])
                    for i, step in enumerate(steps):
                        if 'answer' in step:
                            answers_text += f"Nivel {i+1}: {step['answer']}\n"
                except:
                    answers_text = "No se pudieron extraer las respuestas automáticas."

                # D. Enviar Email vía SendGrid
                if customer_email:
                    send_delivery_email(customer_email, final_link, qr_b64, answers_text, title)

    return jsonify(success=True)

# ==========================================================================
# SECCIÓN 7: VISTAS FINALES (DEMO VS JUEGO)
# ==========================================================================
@app.route('/demo/default')
def demo():
    # Demo estática (JSON local)
    try:
        json_path = os.path.join(app.static_folder, 'plantillas', 'logica.json')
        with open(json_path, 'r', encoding='utf-8') as f: game_data = json.load(f)
        return render_template('demo.html', game_data=json.dumps(game_data), is_demo=False)
    except: return "Demo no encontrada", 404

@app.route("/demo/<game_id>")
def demo_experience(game_id):
    # Preview para el creador (con marca de agua)
    exp = Experience.query.get_or_404(game_id)
    return render_template("player.html", game_data=json.dumps(exp.game_data), is_demo=True, game_id=game_id)

@app.route("/experience/<game_id>")
def play_experience(game_id):
    # Juego final para el destinatario
    exp = Experience.query.get_or_404(game_id)
    
    # SI NO HA PAGADO -> Redirigir a Demo
    if not exp.is_paid:
        return redirect(url_for('demo_experience', game_id=game_id))
    
    # SI HA PAGADO -> Mostrar juego completo + Regalo
    return render_template("player.html", 
                           game_data=json.dumps(exp.game_data), 
                           real_gift=exp.real_gift, 
                           is_demo=False)

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)