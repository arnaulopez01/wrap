/**
 * DIGITAL WRAP - CREATOR ENGINE
 * Sincronización 1:1, Tematización Dinámica y Edición Proporcional
 */

let currentGamedata = window.serverData || null;
let activeLevel = 0;
const TOTAL_STEPS = 6;

// Elementos del DOM
const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const gamePreview = document.getElementById('game-preview');
const levelIndicator = document.getElementById('level-indicator');
const previewSection = document.getElementById('preview-section');
const themeSelector = document.getElementById('theme-selector');

/**
 * Función de auto-ajuste: elimina líneas en blanco extra y 
 * ajusta la altura del textarea al contenido real.
 */
function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
}

/**
 * 1. MOTOR DE RENDERIZADO (FIDELIDAD TOTAL)
 */
function updatePreview() {
    if (!currentGamedata || !currentGamedata.steps) return;
    
    // Sincronizamos el tema visual. Al aplicar themeClass al aside, 
    // el footer transparente hereda el fondo automáticamente.
    const themeClass = currentGamedata.theme || 'theme-default';
    previewSection.className = `hidden md:flex w-full md:w-1/2 preview-body-mock flex-col relative overflow-hidden items-center justify-center transition-all duration-700 ${themeClass}`;

    const step = currentGamedata.steps[activeLevel];
    if (levelIndicator) levelIndicator.innerText = `${activeLevel + 1} / ${TOTAL_STEPS}`;

    // Estructura de la tarjeta:
    // 'flex-1 flex flex-col justify-center' asegura el centrado vertical perfecto.
    gamePreview.innerHTML = `
        <div id="theme-icon" class="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl border border-white/10 z-20" 
             style="background-color: var(--primary)">
            <i class="fa-solid ${getThemeIcon(themeClass)} text-white"></i>
        </div>

        <div id="quiz-area" class="w-full flex-1 flex flex-col justify-center relative z-10">
            ${step.type === 'intro' ? renderIntroMirror(step) : renderLevelMirror(step)}
        </div>
    `;

    // Ajustar alturas tras el renderizado
    setTimeout(() => {
        document.querySelectorAll('#game-preview textarea').forEach(autoResize);
    }, 0);
}

function getThemeIcon(theme) {
    const icons = {
        'theme-navidad': 'fa-tree',
        'theme-san-valentin': 'fa-heart',
        'theme-cumpleanos': 'fa-cake-candles',
        'theme-hacker': 'fa-terminal',
        'theme-default': 'fa-star'
    };
    return icons[theme] || icons['theme-default'];
}

/**
 * Renders la Portada (Intro)
 */
function renderIntroMirror(step) {
    return `
        <div class="flex flex-col items-center justify-center text-center space-y-8 animate-fade-in py-4">
            <div class="space-y-4 w-full">
                <div class="editable-zone">
                    <textarea id="title-input" 
                        oninput="updateStepContent('title', this.value); autoResize(this)" 
                        class="no-scrollbar w-full text-3xl md:text-4xl font-bold leading-tight bg-transparent border-none outline-none resize-none text-center font-title" 
                        style="color: var(--primary)" rows="1">${step.title || ""}</textarea>
                </div>
                <div class="editable-zone">
                    <textarea id="subtitle-input" 
                        oninput="updateStepContent('subtitle', this.value); autoResize(this)" 
                        class="no-scrollbar w-full text-lg opacity-80 italic font-medium bg-transparent border-none outline-none resize-none text-center" 
                        rows="1">${step.subtitle || ""}</textarea>
                </div>
            </div>
            <button class="w-full py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg btn-primary text-white opacity-90 cursor-default">
                Comenzar Experiencia
            </button>
        </div>`;
}

/**
 * Renders un Nivel
 */
function renderLevelMirror(step) {
    return `
        <div class="flex flex-col text-left animate-fade-in py-2">
            <div class="mb-6">
                <span class="text-xs font-mono font-bold uppercase tracking-widest leading-none" style="color: var(--primary)">LEVEL 0${activeLevel}</span>
                <div class="editable-zone mt-2">
                    <textarea id="level-title-input" 
                        oninput="updateStepContent('level_title', this.value); autoResize(this)" 
                        class="no-scrollbar w-full text-2xl font-bold bg-transparent border-none outline-none resize-none font-title" 
                        style="color: var(--primary)" rows="1">${step.level_title || ""}</textarea>
                </div>
            </div>
            
            <div class="mb-8">
                <div class="editable-zone">
                    <textarea id="question-area" 
                        oninput="updateStepContent('question', this.value); autoResize(this)" 
                        class="no-scrollbar w-full text-lg font-medium leading-relaxed bg-transparent border-none outline-none resize-none" 
                        rows="1">${step.question || ""}</textarea>
                </div>
            </div>

            <div class="space-y-4">
                <input type="text" oninput="updateStepContent('answer', this.value)"
                    class="w-full bg-black/20 border border-white/10 rounded-2xl py-4 px-6 outline-none text-white font-medium text-center focus:border-purple-500 transition-all" 
                    value="${step.answer || ""}" readonly placeholder="Respuesta correcta...">
                
                <button class="w-full py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg btn-primary text-white opacity-80 cursor-default">
                    Verificar Respuesta
                </button>
            </div>
        </div>`;
}

/**
 * 2. SINCRONIZACIÓN Y GUARDADO
 */
function updateStepContent(key, val) {
    currentGamedata.steps[activeLevel][key] = val;
}

async function manualSave() {
    const btn = document.getElementById('save-btn');
    if (!btn) return;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch animate-spin"></i>';
    try {
        await fetch('/save_experience', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game_data: currentGamedata })
        });
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Guardar';
        setTimeout(() => { btn.innerHTML = original; }, 2000);
    } catch (e) { 
        btn.innerHTML = 'Error'; 
        setTimeout(() => btn.innerHTML = original, 2000); 
    }
}

/**
 * 3. LÓGICA DE CHAT IA
 */
async function send() {
    const text = userInput.value.trim();
    if (!text) return;

    const themeToPreserve = themeSelector.value;
    renderMessage(text, 'user');
    userInput.value = '';

    const typingId = showTypingIndicator();

    try {
        const res = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, current_json: currentGamedata })
        });
        const data = await res.json();
        
        removeTypingIndicator(typingId);
        renderMessage(data.reply, 'model');

        if (data.reply.includes('###JSON_DATA###')) {
            const parts = data.reply.split('###JSON_DATA###');
            const newJson = JSON.parse(parts[1].trim());
            newJson.theme = themeToPreserve;
            currentGamedata = newJson;
            updatePreview();
        }
    } catch (e) {
        removeTypingIndicator(typingId);
        renderMessage("Error al conectar con la IA.", 'model');
    }
}

function showTypingIndicator() {
    const id = 'typing-' + Date.now();
    const wrapper = document.createElement('div');
    wrapper.id = id;
    wrapper.className = 'flex justify-start w-full mb-4 animate-msg';
    wrapper.innerHTML = `
        <div class="bubble bubble-ai flex items-center gap-1.5 py-4 px-6">
            <div class="typing-dot"></div>
            <div class="typing-dot" style="animation-delay: 0.2s"></div>
            <div class="typing-dot" style="animation-delay: 0.4s"></div>
        </div>`;
    chatWindow.appendChild(wrapper);
    chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: 'smooth' });
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function renderMessage(text, role) {
    const cleanText = text.split('###JSON_DATA###')[0].trim();
    const wrapper = document.createElement('div');
    wrapper.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'} w-full mb-4 animate-msg`;
    wrapper.innerHTML = `
        <div class="bubble ${role === 'user' ? 'bubble-user' : 'bubble-ai'}">
            ${role === 'model' ? marked.parse(cleanText) : `<p>${cleanText}</p>`}
        </div>`;
    chatWindow.appendChild(wrapper);
    chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: 'smooth' });
}

/**
 * 4. NAVEGACIÓN Y FINALIZACIÓN
 */
function nextLevel() { if (activeLevel < TOTAL_STEPS - 1) { activeLevel++; updatePreview(); } }
function prevLevel() { if (activeLevel > 0) { activeLevel--; updatePreview(); } }

function finalize() {
    const modalHtml = `
        <div id="finalize-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-msg">
            <div class="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] max-w-sm w-full text-center space-y-6 shadow-2xl">
                <div class="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto">
                    <i class="fa-solid fa-gift text-purple-400 text-2xl"></i>
                </div>
                <div class="space-y-2">
                    <h3 class="text-2xl font-bold text-white">Regalo Final</h3>
                    <p class="text-slate-400 text-sm">Escribe el regalo que verá el destinatario al completar el juego.</p>
                </div>
                <textarea id="final-gift-input" placeholder="Ej: Vuelo a París..." class="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-purple-500 transition-all text-sm text-white h-24 resize-none"></textarea>
                <div class="flex gap-3">
                    <button onclick="document.getElementById('finalize-modal').remove()" class="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-xl font-bold text-xs transition-all uppercase tracking-widest">Cancelar</button>
                    <button onclick="confirmFinalize()" class="flex-1 bg-purple-600 hover:bg-purple-500 py-3 rounded-xl font-bold text-xs transition-all uppercase tracking-widest text-white shadow-lg">Confirmar</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function confirmFinalize() {
    const gift = document.getElementById('final-gift-input').value.trim();
    if (!gift) return;
    await fetch('/save_experience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_data: currentGamedata, real_gift: gift })
    });
    window.location.href = `/demo/${window.currentGameId}`;
}

/**
 * 5. INICIALIZACIÓN
 */
document.addEventListener('DOMContentLoaded', () => {
    updatePreview();
    if (themeSelector && currentGamedata) {
        themeSelector.value = currentGamedata.theme || 'theme-default';
        themeSelector.addEventListener('change', (e) => {
            currentGamedata.theme = e.target.value;
            updatePreview();
            manualSave();
        });
    }
});

userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') send(); });