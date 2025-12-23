/**
 * DIGITAL WRAP - CREATOR ENGINE (RESTAURADO & MEJORADO)
 * Portada épica sincronizada con la demo + Entorno de edición original.
 * v. Selector de Temas + Modal de Regalo Final.
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
 * 1. RENDERIZADO DEL PREVIEW (MODO ESPEJO)
 */
function updatePreview() {
    if (!currentGamedata || !currentGamedata.steps) return;
    
    // Aplicar el tema solo al fondo de la derecha (Aside)
    const themeClass = currentGamedata.theme || 'theme-default';
    previewSection.className = `hidden md:flex w-full md:w-[50%] preview-body-mock flex-col relative transition-all ${themeClass}`;

    const step = currentGamedata.steps[activeLevel];
    if (levelIndicator) levelIndicator.innerText = `${activeLevel + 1} / ${TOTAL_STEPS}`;

    gamePreview.innerHTML = ""; 

    if (step.type === 'intro') {
        gamePreview.innerHTML = renderIntroMirror(step);
    } else {
        gamePreview.innerHTML = renderLevelMirror(step);
    }
}

/**
 * PORTADA (NIVEL 1)
 */
function renderIntroMirror(step) {
    return `
        <div class="flex flex-col items-center justify-center min-h-[400px] text-center space-y-8 animate-msg">
            <div class="w-full">
                <div class="editable-zone group text-center mb-4">
                    <i class="fa-solid fa-pencil absolute opacity-0 group-hover:opacity-100 transition-opacity text-[10px]" 
                       style="right: 5%; top: 10px;"></i>
                    <textarea id="title-input" oninput="updateStepContent('title', this.value)" 
                        rows="2" class="no-scrollbar">${step.title || "Título del Regalo"}</textarea>
                    <span class="edit-hint">Editar título principal</span>
                </div>

                <div class="editable-zone group text-center">
                    <i class="fa-solid fa-pencil absolute opacity-0 group-hover:opacity-100 transition-opacity text-[10px]" 
                       style="right: 10%; top: 5px;"></i>
                    <textarea id="subtitle-input" oninput="updateStepContent('subtitle', this.value)" 
                        rows="2" class="no-scrollbar">${step.subtitle || "Un pequeño mensaje para empezar..."}</textarea>
                </div>
            </div>

            <div class="w-full max-w-[220px] py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg btn-primary text-white opacity-90 cursor-not-allowed text-xs">
                Comenzar Aventura
            </div>
        </div>`;
}

/**
 * NIVELES DE JUEGO (2-6)
 */
function renderLevelMirror(step) {
    return `
        <div class="flex flex-col min-h-[400px] text-left animate-msg">
            <div class="mb-8 editable-zone group">
                <i class="fa-solid fa-pencil absolute right-2 top-0 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"></i>
                <span class="text-xs font-mono font-bold uppercase tracking-widest leading-none" style="color: var(--primary)">NIVEL 0${activeLevel}</span>
                <textarea id="level-title-input" oninput="updateStepContent('level_title', this.value)" 
                    rows="1" class="text-2xl font-bold mt-2">${step.level_title || ""}</textarea>
            </div>
            
            <div class="flex-1 mb-8 editable-zone group">
                <i class="fa-solid fa-pencil absolute right-2 top-0 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"></i>
                <textarea id="question-area" oninput="updateStepContent('question', this.value)" 
                    class="no-scrollbar text-lg font-medium leading-relaxed" rows="4">${step.question || ""}</textarea>
            </div>

            <div class="space-y-4">
                <div class="input-mirror-container">
                    <input type="text" oninput="updateStepContent('answer', this.value)" 
                        class="answer-input-v" value="${step.answer || ""}" placeholder="Respuesta...">
                </div>
                <div class="w-full py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg btn-primary text-white opacity-80 text-center text-xs">
                    Verificar Código
                </div>
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
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch animate-spin"></i> Guardando...';

    try {
        await fetch('/save_experience', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game_data: currentGamedata })
        });
        btn.classList.replace('bg-slate-800', 'bg-green-600');
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Guardado';
        setTimeout(() => {
            btn.classList.replace('bg-green-600', 'bg-slate-800');
            btn.innerHTML = originalContent;
        }, 2000);
    } catch (e) {
        btn.innerHTML = 'Error';
        setTimeout(() => btn.innerHTML = originalContent, 2000);
    }
}

/**
 * 3. LÓGICA DE CHAT IA
 */
async function send() {
    const text = userInput.value.trim();
    if (!text) return;

    renderMessage(text, 'user');
    userInput.value = '';

    try {
        const res = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, current_json: currentGamedata })
        });
        const data = await res.json();
        
        renderMessage(data.reply, 'model');

        if (data.reply.includes('###JSON_DATA###')) {
            const parts = data.reply.split('###JSON_DATA###');
            const jsonStr = parts[1].trim();
            currentGamedata = JSON.parse(jsonStr);
            updatePreview();
        }
    } catch (e) {
        renderMessage("Error al conectar con la IA.", 'model');
    }
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
 * 4. NAVEGACIÓN Y FINALIZACIÓN (MODAL PERSONALIZADO)
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
                <textarea id="final-gift-input" placeholder="Ej: Vuelo a París para dos personas..." 
                       class="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-purple-500 transition-all text-sm text-white h-24 resize-none"></textarea>
                <div class="flex gap-3">
                    <button onclick="document.getElementById('finalize-modal').remove()" class="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-xl font-bold text-xs transition-all uppercase tracking-widest">Cancelar</button>
                    <button onclick="confirmFinalize()" class="flex-1 bg-purple-600 hover:bg-purple-500 py-3 rounded-xl font-bold text-xs transition-all uppercase tracking-widest text-white shadow-lg">Confirmar</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function confirmFinalize() {
    const giftInput = document.getElementById('final-gift-input');
    const gift = giftInput.value.trim();
    if (!gift) { giftInput.classList.add('border-red-500'); return; }

    try {
        await fetch('/save_experience', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game_data: currentGamedata, real_gift: gift })
        });
        window.location.href = `/demo/${window.currentGameId}`;
    } catch (e) {
        alert("Error al guardar.");
    }
}

/**
 * 5. INICIALIZACIÓN
 */
document.addEventListener('DOMContentLoaded', () => {
    updatePreview();

    // Sincronizar el selector de temas con el JSON
    if (themeSelector && currentGamedata) {
        themeSelector.value = currentGamedata.theme || 'theme-default';
        themeSelector.addEventListener('change', (e) => {
            currentGamedata.theme = e.target.value;
            updatePreview();
            manualSave(); // Guardar automáticamente al cambiar de tema
        });
    }
});

userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') send(); });