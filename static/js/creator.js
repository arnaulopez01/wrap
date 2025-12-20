// Referencias a elementos del DOM
const chatWindow = document.getElementById('chat-window');
const input = document.getElementById('user-input');
const preview = document.getElementById('game-preview');
const statusTag = document.getElementById('status-tag');
let currentGamedata = null;

// Enviar mensaje al servidor
async function send() {
    const text = input.value.trim();
    if (!text) return;
    renderMessage(text, 'user');
    input.value = '';

    try {
        const res = await fetch('/chat', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({message: text})
        });
        const data = await res.json();
        renderMessage(data.reply, 'model');
    } catch (e) { 
        console.error(e); 
    }
}

// Renderizar mensajes en la UI
function renderMessage(text, role) {
    const parts = text.split('###JSON_DATA###');
    const chatText = parts[0].trim();
    const jsonPart = parts[1] ? parts[1].trim() : null;

    const wrapper = document.createElement('div');
    wrapper.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'} animate-msg w-full`;
    wrapper.innerHTML = `<div class="bubble ${role === 'user' ? 'bubble-user' : 'bubble-ai'}"><div class="markdown-content">${marked.parse(chatText)}</div></div>`;
    
    chatWindow.appendChild(wrapper);
    chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: 'smooth' });

    if (jsonPart && role === 'model') updatePreview(jsonPart);
}

// Actualizar el panel de previsualización con el JSON recibido
function updatePreview(jsonStr) {
    try {
        const cleanJson = jsonStr.replace(/```json|```/g, '').trim();
        currentGamedata = JSON.parse(cleanJson);
        statusTag.classList.remove('hidden');
        
        let stepsHtml = currentGamedata.steps.map((s, i) => `
            <div class="bg-white/5 border border-white/5 p-5 rounded-2xl mb-4 text-left">
                <span class="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-md font-bold uppercase">Reto 0${i+1}</span>
                <p class="text-sm text-slate-200 mt-2 font-medium">${s.question}</p>
                <p class="text-xs text-green-400 font-bold mt-2 font-mono">Respuesta: ${s.answer}</p>
            </div>
        `).join('');

        preview.innerHTML = `
            <div class="w-full h-full flex flex-col text-left">
                <h3 class="text-2xl font-bold text-white mb-2">${currentGamedata.title}</h3>
                <div class="flex-1 overflow-y-auto pr-2 custom-scroll">${stepsHtml}</div>
                <button onclick="finalize()" class="mt-8 w-full bg-white text-black py-4 rounded-2xl font-bold hover:bg-purple-500 hover:text-white transition-all shadow-xl">
                    CREAR JUEGO E INTERACTUAR
                </button>
            </div>
        `;
        preview.classList.remove('justify-center', 'items-center', 'text-center');
    } catch (e) { 
        console.error("JSON incompleto"); 
    }
}

// Finalizar y guardar la experiencia
async function finalize() {
    const gift = prompt("Escribe tu regalo aquí (ej: 2 entradas a PortAventura):");
    if (!gift) return;

    const res = await fetch('/save_experience', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ game_data: currentGamedata, real_gift: gift })
    });
    const result = await res.json();
    if (result.success) window.location.href = `/experience/${result.game_id}`;
}

// Escuchar tecla Enter
input.addEventListener('keypress', (e) => { 
    if(e.key === 'Enter') send(); 
});