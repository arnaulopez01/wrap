import os
import json
import re
import uuid
from flask import Flask, render_template, request, jsonify, session
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Importamos los prompts especializados
from prompts import PRODUCT_PROMPTS

load_dotenv()

app = Flask(__name__)

# CONFIGURACIÓN CRÍTICA
# Secret Key es obligatoria para que las sesiones (session) funcionen
app.secret_key = os.getenv("FLASK_KEY", "digital_wrap_secret_2025_key")

# Configuración Gemini 2.5 Flash
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL_NAME = "gemini-2.5-flash" # O gemini-2.5-flash según disponibilidad de tu tier

# Simulación de base de datos (Próximo paso: migrar a PostgreSQL)
experiences_db = {}

@app.route("/")
def landing():
    return render_template("landing.html")

@app.route("/create")
def creator():
    # Al entrar en /create, reiniciamos el historial del chat para este usuario
    session['chat_history'] = []
    return render_template("creator.html")

@app.route("/chat", methods=["POST"])
def chat():
    # 1. Obtener datos de la petición
    user_message = request.json.get("message")
    product_type = request.json.get("product_type", "quiz") # Por defecto quiz
    
    # 2. Recuperar o inicializar el historial de la sesión
    history = session.get('chat_history', [])
    
    # 3. Seleccionar el prompt de sistema según el producto elegido
    system_instruction = PRODUCT_PROMPTS.get(product_type, PRODUCT_PROMPTS["quiz"])
    
    # 4. Añadir mensaje del usuario al historial
    history.append({"role": "user", "content": user_message})

    # 5. Convertir el historial al formato que espera la SDK de GenAI
    gemini_history = []
    for msg in history:
        role_api = "model" if msg["role"] == "assistant" else "user"
        gemini_history.append(
            types.Content(
                role=role_api, 
                parts=[types.Part.from_text(text=msg["content"])]
            )
        )

    try:
        # 6. Llamada a Gemini 2.5 Flash
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=gemini_history,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7,
                max_output_tokens=4000 
            )
        )
        
        full_text = response.text
        
        # 7. Limpieza de formato JSON si Gemini añade bloques de código
        if "###JSON_DATA###" in full_text:
            parts = full_text.split("###JSON_DATA###")
            # Eliminamos posibles ```json ... ``` que la IA pueda añadir por inercia
            json_clean = re.sub(r'```[a-z]*\n?|```', '', parts[1]).strip()
            full_text = f"{parts[0]}###JSON_DATA###{json_clean}"

        # 8. Guardar la respuesta en el historial de la sesión
        history.append({"role": "assistant", "content": full_text})
        session['chat_history'] = history
        session.modified = True # Forzamos el guardado de la sesión
        
        return jsonify({"reply": full_text})

    except Exception as e:
        print(f"Error en Gemini API: {str(e)}")
        return jsonify({"reply": f"Error del Arquitecto IA: {str(e)}"}), 500

@app.route("/save_experience", methods=["POST"])
def save_experience():
    data = request.json
    # Generamos un ID corto y único para la URL del juego
    game_id = str(uuid.uuid4())[:8]
    
    # Guardamos en nuestro diccionario temporal
    experiences_db[game_id] = {
        "game_data": data['game_data'],
        "real_gift": data['real_gift']
    }
    
    return jsonify({"success": True, "game_id": game_id})

@app.route("/experience/<game_id>")
def play_experience(game_id):
    # Buscamos el juego en la "DB"
    exp = experiences_db.get(game_id)
    
    if not exp:
        return "Experiencia no encontrada o link expirado", 404
    
    # Pasamos los datos al player.html
    # Usamos json.dumps para asegurar que el objeto sea válido en JS
    return render_template(
        "player.html", 
        game_data=json.dumps(exp['game_data']), 
        real_gift=exp['real_gift']
    )

if __name__ == "__main__":
    # Importante: host 0.0.0.0 para pruebas en red local si fuera necesario
    app.run(debug=True, port=5000)