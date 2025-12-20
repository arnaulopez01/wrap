import os
import json
import re
import uuid
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()
app = Flask(__name__)

# Configuración Gemini 2.5 Flash
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL_NAME = "gemini-2.5-flash"

# Simulación de base de datos
experiences_db = {}

SYSTEM_PROMPT_CHAT = """
Eres el motor de 'Digital Wrap Experiences'. Tu misión es diseñar juegos para envolver regalos.

REGLAS DE FORMATO CRÍTICAS:
1. Responde SIEMPRE usando Markdown para la narrativa.
2. Al final de tu mensaje, añade el delimitador '###JSON_DATA###'.
3. Inmediatamente después, pon el objeto JSON puro (sin bloques ```json).
4. El JSON debe ser: {"type": "quiz", "title": "Nombre", "steps": [{"question": "...", "answer": "...", "hint": "..."}]}
"""

conversation = []

@app.route("/")
def landing(): return render_template("landing.html")

@app.route("/create")
def creator():
    global conversation
    conversation = []
    return render_template("creator.html")

@app.route("/chat", methods=["POST"])
def chat():
    global conversation
    user_message = request.json.get("message")
    conversation.append({"role": "user", "content": user_message})

    gemini_history = []
    for msg in conversation:
        role_api = "model" if msg["role"] == "assistant" else "user"
        gemini_history.append(types.Content(role=role_api, parts=[types.Part.from_text(text=msg["content"])]))

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=gemini_history,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT_CHAT,
                temperature=0.7,
                max_output_tokens=4000 
            )
        )
        
        full_text = response.text
        if "###JSON_DATA###" in full_text:
            parts = full_text.split("###JSON_DATA###")
            json_clean = re.sub(r'```[a-z]*\n?|```', '', parts[1]).strip()
            full_text = f"{parts[0]}###JSON_DATA###{json_clean}"

        conversation.append({"role": "assistant", "content": full_text})
        return jsonify({"reply": full_text})
    except Exception as e:
        return jsonify({"reply": f"Error: {str(e)}"}), 500

@app.route("/save_experience", methods=["POST"])
def save_experience():
    data = request.json
    game_id = str(uuid.uuid4())[:8]
    experiences_db[game_id] = {
        "game_data": data['game_data'],
        "real_gift": data['real_gift']
    }
    return jsonify({"success": True, "game_id": game_id})

@app.route("/experience/<game_id>")
def play_experience(game_id):
    exp = experiences_db.get(game_id)
    if not exp: return "No encontrado", 404
    return render_template("player.html", game_data=json.dumps(exp['game_data']), real_gift=exp['real_gift'])

if __name__ == "__main__":
    app.run(debug=True, port=5000)