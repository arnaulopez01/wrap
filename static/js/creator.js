// Referencias a elementos del DOM
const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const gamePreview = document.getElementById('game-preview');
const statusTag = document.getElementById('status-tag');
const productSelector = document.getElementById('product-selector');

let currentGamedata = null;

/**
 * Envía el mensaje al backend incluyendo el tipo de producto seleccionado
 */
async function send() {
    const text = userInput.value.trim();
    // Capturamos el producto del selector (quiz, gymkhana, escape)
    const productType = productSelector ? productSelector.value : 'quiz';

    if (!text) return;

    // Renderizamos el mensaje del usuario en el chat
    renderMessage(text, 'user');
    userInput.value = '';

    try {
        const res = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: text,
                product_type: productType 
            })
        });

        if (!res.ok) throw new Error("Error en la respuesta del servidor");

        const data = await res.json();
        // data.reply contiene: "Narrativa... ###JSON_DATA### {json...}"
        renderMessage(data.reply, 'model');

    } catch (e) {
        console.error("Error al enviar mensaje:", e);
        renderMessage("Lo siento, hubo un error al conectar con Gemini 2.5 Flash.", 'model');
    }
}

/**
 * Renderiza los mensajes y separa la narrativa del JSON
 */
function renderMessage(text, role) {
    // Dividimos por el delimitador definido en el prompt
    const parts = text.split('###JSON_DATA###');
    const chatText = parts[0].trim();
    const jsonPart = parts[1] ? parts[1].trim() : null;

    // Crear el contenedor del mensaje
    const wrapper = document.createElement('div');
    wrapper.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'} animate-msg w-full`;
    
    // Usamos marked.parse para el markdown de la narrativa
    const contentHtml = role === 'model' ? marked.parse(chatText) : chatText;

    wrapper.innerHTML = `
        <div class="bubble ${role === 'user' ? 'bubble-user' : 'bubble-ai'}">
            <div class="markdown-content">${contentHtml}</div>
        </div>
    `;
    
    chatWindow.appendChild(wrapper);
    
    // Auto-scroll al fondo
    chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: 'smooth' });

    // Si hay JSON y es respuesta de la IA, actualizamos la preview
    if (jsonPart && role === 'model') {
        updatePreview(jsonPart);
    }
}

/**
 * Actualiza el panel derecho con la estructura del juego
 */
function updatePreview(jsonStr) {
    try {
        // Limpiamos posibles bloques de código markdown que la IA pueda colar
        const cleanJson = jsonStr.replace(/```json|```/g, '').trim();
        currentGamedata = JSON.parse(cleanJson);
        
        // Mostramos el tag de "Listo"
        if (statusTag) statusTag.classList.remove('hidden');
        
        // Generamos el HTML de los pasos (preguntas/retos)
        let stepsHtml = currentGamedata.steps.map((s, i) => `
            <div class="bg-white/5 border border-white/5 p-5 rounded-2xl mb-4 text-left border-l-4 border-l-purple-500">
                <span class="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-md font-bold uppercase">
                    Paso 0${i+1}
                </span>
                <p class="text-sm text-slate-200 mt-2 font-medium">${s.question}</p>
                <p class="text-xs text-green-400 font-bold mt-2 font-mono">
                    <i class="fa-solid fa-key mr-1"></i> ${s.answer}
                </p>
            </div>
        `).join('');

        // Inyectamos en el panel de preview
        gamePreview.innerHTML = `
            <div class="w-full h-full flex flex-col text-left">
                <div class="mb-6">
                    <h3 class="text-2xl font-bold text-white">${currentGamedata.title}</h3>
                    <p class="text-xs text-slate-500 uppercase tracking-widest mt-1">Formato: ${currentGamedata.type || 'Personalizado'}</p>
                </div>
                <div class="flex-1 overflow-y-auto pr-2 custom-scroll">
                    ${stepsHtml}
                </div>
                <button onclick="finalize()" class="mt-8 w-full bg-white text-black py-4 rounded-2xl font-bold hover:bg-purple-500 hover:text-white transition-all shadow-xl shadow-purple-500/10">
                    CONFIRMAR Y GUARDAR WRAP
                </button>
            </div>
        `;
        
        // Quitamos las clases de centrado del placeholder inicial
        gamePreview.classList.remove('justify-center', 'items-center', 'text-center');

    } catch (e) {
        console.error("Error al parsear el JSON de la preview:", e);
    }
}

/**
 * Guarda la experiencia y redirige al player
 */
async function finalize() {
    if (!currentGamedata) return;

    const gift = prompt("Define el regalo real (esto no lo verá la IA, solo el destinatario al final):", "Ej: Un viaje a París");
    
    if (!gift) return;

    try {
        const res = await fetch('/save_experience', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                game_data: currentGamedata, 
                real_gift: gift 
            })
        });

        const result = await res.json();
        if (result.success) {
            window.location.href = `/experience/${result.game_id}`;
        }
    } catch (e) {
        alert("Error al guardar la experiencia.");
    }
}

// Escuchar la tecla Enter en el input
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') send();
});