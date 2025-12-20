const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const gamePreview = document.getElementById('game-preview');
const statusTag = document.getElementById('status-tag');
const productSelector = document.getElementById('product-selector');

let currentGamedata = null;

async function send() {
    const text = userInput.value.trim();
    const productType = productSelector ? productSelector.value : 'quiz';

    if (!text) return;

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

        const data = await res.json();
        renderMessage(data.reply, 'model');

    } catch (e) {
        console.error("Error:", e);
        renderMessage("Error al conectar con Gemini 2.5 Flash.", 'model');
    }
}

function renderMessage(text, role) {
    const parts = text.split('###JSON_DATA###');
    const chatText = parts[0].trim();
    const jsonPart = parts[1] ? parts[1].trim() : null;

    const wrapper = document.createElement('div');
    wrapper.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'} animate-msg w-full`;
    
    const contentHtml = role === 'model' ? marked.parse(chatText) : `<p>${chatText}</p>`;

    wrapper.innerHTML = `
        <div class="bubble ${role === 'user' ? 'bubble-user' : 'bubble-ai'}">
            <div class="markdown-content text-white">${contentHtml}</div>
        </div>
    `;
    
    chatWindow.appendChild(wrapper);
    chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: 'smooth' });

    if (jsonPart && role === 'model') {
        updatePreview(jsonPart);
    }
}

function updatePreview(jsonStr) {
    try {
        const cleanJson = jsonStr.replace(/```json|```/g, '').trim();
        currentGamedata = JSON.parse(cleanJson);
        
        if (statusTag) statusTag.classList.remove('hidden');
        
        let stepsHtml = currentGamedata.steps.map((s, i) => `
            <div class="bg-white/5 border border-white/5 p-5 rounded-2xl mb-4 text-left border-l-4 border-l-purple-500">
                <span class="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-md font-bold uppercase">Paso 0${i+1}</span>
                <p class="text-sm text-slate-200 mt-2 font-medium">${s.question}</p>
                <p class="text-xs text-green-400 font-bold mt-2 font-mono"><i class="fa-solid fa-key mr-1"></i> ${s.answer}</p>
            </div>
        `).join('');

        gamePreview.innerHTML = `
            <div class="w-full h-full flex flex-col text-left">
                <div class="mb-6">
                    <h3 class="text-2xl font-bold text-white">${currentGamedata.title}</h3>
                    <p class="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Formato: ${currentGamedata.type || 'Custom'}</p>
                </div>
                <div class="flex-1 overflow-y-auto pr-2 custom-scroll">${stepsHtml}</div>
                <button onclick="finalize()" class="mt-8 w-full bg-white text-black py-4 rounded-2xl font-bold hover:bg-purple-500 hover:text-white transition-all shadow-xl">
                    CONFIRMAR WRAP
                </button>
            </div>
        `;
        
        gamePreview.classList.remove('justify-center', 'items-center', 'text-center');

        // Notificación visual en botón móvil
        const toggleBtn = document.getElementById('mobile-toggle-btn');
        if (window.innerWidth < 768 && toggleBtn) {
            toggleBtn.classList.add('animate-bounce', 'bg-green-500');
            setTimeout(() => toggleBtn.classList.remove('animate-bounce'), 3000);
        }

    } catch (e) { console.error("Error parseando JSON", e); }
}

function toggleMobileView() {
    const chatSection = document.getElementById('chat-section');
    const previewSection = document.getElementById('preview-section');
    const toggleBtn = document.getElementById('mobile-toggle-btn');
    const icon = toggleBtn.querySelector('i');

    if (previewSection.classList.contains('hidden')) {
        previewSection.classList.remove('hidden');
        previewSection.classList.add('flex');
        chatSection.classList.add('hidden');
        icon.className = 'fa-solid fa-comment';
        toggleBtn.classList.replace('bg-purple-600', 'bg-slate-700');
        toggleBtn.classList.remove('bg-green-500');
    } else {
        previewSection.classList.add('hidden');
        previewSection.classList.remove('flex');
        chatSection.classList.remove('hidden');
        icon.className = 'fa-solid fa-eye';
        toggleBtn.classList.replace('bg-slate-700', 'bg-purple-600');
    }
}

async function finalize() {
    if (!currentGamedata) return;
    const gift = prompt("Define el regalo real (ej: Vuelo a Roma):");
    if (!gift) return;

    const res = await fetch('/save_experience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_data: currentGamedata, real_gift: gift })
    });

    const result = await res.json();
    if (result.success) window.location.href = `/experience/${result.game_id}`;
}

userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') send(); });