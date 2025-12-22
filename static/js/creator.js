/**
 * DIGITAL WRAP - creator.js
 * Versión Final: Mirror Mode Estático (Sin animaciones)
 */

let currentGamedata = window.serverData || null;
let activeLevel = 0;
const TOTAL_LEVELS = 6;

const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const gamePreview = document.getElementById('game-preview');
const productSelector = document.getElementById('product-selector');
const levelIndicator = document.getElementById('level-indicator');

// --- 1. UTILIDADES (AUTO-SHRINK SIN TRANSICIONES) ---
function adjustFontSize(el, minSize, maxSize) {
    if (!el) return;
    let size = maxSize;
    el.style.fontSize = size + "px";
    // Ajuste inmediato para evitar parpadeos
    while (el.scrollHeight > el.clientHeight && size > minSize) {
        size--;
        el.style.fontSize = size + "px";
    }
}

// --- 2. RENDERIZADO PRINCIPAL (MODO ESPEJO ESTÁTICO) ---
function updatePreview() {
    if (!currentGamedata || !currentGamedata.steps) return;
    
    const step = currentGamedata.steps[activeLevel];
    if (levelIndicator) levelIndicator.innerText = `${activeLevel + 1} / ${TOTAL_LEVELS}`;

    // Limpieza total antes de inyectar para evitar residuos visuales
    gamePreview.innerHTML = "";

    if (activeLevel === 0) {
        gamePreview.innerHTML = renderPortadaEspejo(step);
    } 
    else if (!step.module || step.module === null) {
        gamePreview.innerHTML = renderEstadoVacio();
    } 
    else {
        gamePreview.innerHTML = renderModuloEspejo(step);
    }

    // Ajuste de fuentes sincronizado
    setTimeout(() => {
        if (activeLevel === 0) {
            adjustFontSize(document.getElementById('title-input'), 24, 40);
            adjustFontSize(document.getElementById('subtitle-input'), 16, 24);
        } else if (step.module) {
            adjustFontSize(document.getElementById('level-title-input'), 20, 32);
            adjustFontSize(document.getElementById('question-area'), 16, 28);
        }
    }, 0);
}

// --- HELPERS DE RENDERIZADO ---

function renderPortadaEspejo(step) {
    return `
        <div class="flex flex-col items-center justify-center min-h-[350px] text-center space-y-8">
            <div class="space-y-4 w-full">
                <div class="editable-zone group relative">
                    <div class="absolute right-2 top-0 text-slate-600 group-hover:text-purple-400 transition-colors pointer-events-none">
                        <i class="fa-solid fa-pencil text-[10px]"></i>
                    </div>
                    <textarea id="title-input" oninput="adjustFontSize(this, 24, 40)" onchange="updateStepContent(0, 'title', this.value)" 
                        class="bg-transparent text-3xl font-bold text-purple-400 leading-tight outline-none w-full text-center resize-none border-none overflow-hidden">${step.title || ""}</textarea>
                </div>
                <div class="editable-zone group relative">
                    <div class="absolute right-2 top-0 text-slate-600 group-hover:text-purple-400 transition-colors pointer-events-none">
                        <i class="fa-solid fa-pencil text-[10px]"></i>
                    </div>
                    <textarea id="subtitle-input" oninput="adjustFontSize(this, 16, 24)" onchange="updateStepContent(0, 'subtitle', this.value)" 
                        class="bg-transparent text-lg text-slate-300 italic font-medium outline-none w-full text-center resize-none border-none overflow-hidden">${step.subtitle || ""}</textarea>
                </div>
            </div>
            <div class="w-full bg-purple-600 py-4 rounded-xl font-bold uppercase tracking-wider shadow-lg shadow-purple-900/20 opacity-90 cursor-not-allowed">
                COMENZAR EXPERIENCIA
            </div>
        </div>`;
}

function renderEstadoVacio() {
    return `
        <div class="flex flex-col items-center justify-center h-full p-2">
            <button onclick="openModuleSelector()" class="group w-full h-64 border-2 border-dashed border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center hover:border-purple-500/30 hover:bg-purple-500/5 transition-all">
                <div class="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <i class="fa-solid fa-plus text-2xl text-slate-600 group-hover:text-purple-400"></i>
                </div>
                <p class="mt-4 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600 group-hover:text-purple-400">Añadir Reto al Nivel ${activeLevel}</p>
            </button>
        </div>`;
}

function renderModuloEspejo(step) {
    return `
        <div class="flex flex-col min-h-[400px] text-left">
            <div class="mb-6 flex justify-between items-start">
                <div class="flex-1 editable-zone group relative">
                    <div class="absolute right-2 top-1 text-slate-600 group-hover:text-purple-400 transition-colors pointer-events-none">
                        <i class="fa-solid fa-pencil text-[10px]"></i>
                    </div>
                    <span class="text-xs text-purple-500 font-mono font-bold uppercase tracking-widest leading-none">LEVEL 0${activeLevel}</span>
                    <textarea id="level-title-input" oninput="adjustFontSize(this, 16, 32)" onchange="updateStepContent(${activeLevel}, 'level_title', this.value)" 
                        class="bg-transparent text-2xl font-bold text-purple-400 mt-2 outline-none w-full resize-none border-none overflow-hidden">${step.level_title || ""}</textarea>
                </div>
                <button onclick="openModuleSelector()" class="text-slate-600 hover:text-purple-400 transition ml-4 bg-white/5 w-10 h-10 rounded-xl flex items-center justify-center border border-white/5">
                    <i class="fa-solid fa-rotate text-sm"></i>
                </button>
            </div>
            
            <div class="flex-1 mb-6 editable-zone group relative">
                <div class="absolute right-2 top-1 text-slate-600 group-hover:text-purple-400 transition-colors pointer-events-none">
                    <i class="fa-solid fa-pencil text-[10px]"></i>
                </div>
                <textarea id="question-area" oninput="adjustFontSize(this, 16, 28)" onchange="updateStepContent(${activeLevel}, 'question', this.value)" 
                    class="w-full bg-transparent text-white text-lg font-medium h-full resize-none outline-none leading-relaxed border-none overflow-hidden">${step.question || ""}</textarea>
            </div>

            <div class="space-y-4">
                <div class="editable-zone p-0 border-none hover:bg-transparent group relative">
                    <div class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 group-hover:text-purple-400 transition-colors pointer-events-none">
                        <i class="fa-solid fa-pencil text-[10px]"></i>
                    </div>
                    
                    <div class="w-full bg-slate-800/50 border border-white/20 rounded-2xl py-4 px-6 flex items-center justify-center group-hover:border-purple-500 transition-colors">
                        <input type="text" onchange="updateStepContent(${activeLevel}, 'answer', this.value)" 
                            class="bg-transparent text-green-400 font-bold text-center outline-none w-full" 
                            value="${step.answer || ""}" placeholder="Respuesta...">
                    </div>
                </div>

                <div class="w-full bg-purple-600 py-4 rounded-xl font-bold uppercase tracking-wider text-center text-sm shadow-lg opacity-90 cursor-not-allowed">
                    VERIFICAR RESPUESTA
                </div>
            </div>
        </div>`;
}

// --- 3. PERSISTENCIA ---
async function saveToDB() {
    if (!currentGamedata) return;
    try {
        await fetch('/save_experience', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game_data: currentGamedata })
        });
    } catch (e) { console.error("Error al guardar en base de datos"); }
}

function updateStepContent(idx, key, val) {
    currentGamedata.steps[idx][key] = val;
    saveToDB();
}

async function manualSave() {
    const btn = document.getElementById('save-btn');
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch animate-spin mr-1"></i> Guardando';
    btn.classList.add('bg-green-600');
    await saveToDB();
    setTimeout(() => {
        btn.innerHTML = original;
        btn.classList.remove('bg-green-600');
    }, 1500);
}

// --- 4. CHAT IA ---
async function send() {
    const text = userInput.value.trim();
    if (!text) return;

    renderMessage(text, 'user');
    userInput.value = '';

    const res = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, product_type: productSelector.value, current_json: currentGamedata })
    });

    const data = await res.json();
    renderMessage(data.reply, 'model');

    if (data.reply.includes('###JSON_DATA###')) {
        const jsonMatch = data.reply.split('###JSON_DATA###')[1].match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            currentGamedata = JSON.parse(jsonMatch[0]);
            updatePreview();
        }
    }
}

function renderMessage(text, role) {
    const chatText = text.split('###JSON_DATA###')[0].trim();
    const wrapper = document.createElement('div');
    wrapper.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'} w-full mb-4`;
    wrapper.innerHTML = `<div class="bubble ${role === 'user' ? 'bubble-user' : 'bubble-ai'}">${role === 'model' ? marked.parse(chatText) : `<p>${chatText}</p>`}</div>`;
    chatWindow.appendChild(wrapper);
    chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: 'smooth' });
}

// --- 5. NAVEGACIÓN ---
function nextLevel() { if (activeLevel < TOTAL_LEVELS - 1) { activeLevel++; updatePreview(); } }
function prevLevel() { if (activeLevel > 0) { activeLevel--; updatePreview(); } }

function toggleMobileView() {
    const chat = document.getElementById('chat-section');
    const preview = document.getElementById('preview-section');
    const btn = document.getElementById('mobile-toggle-btn');
    if (preview.classList.contains('hidden')) {
        preview.classList.remove('hidden'); preview.classList.add('flex'); chat.classList.add('hidden');
        btn.innerHTML = '<i class="fa-solid fa-comment"></i>';
    } else {
        preview.classList.add('hidden'); preview.classList.remove('flex'); chat.classList.remove('hidden');
        btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
    }
}

async function finalize() {
    const gift = prompt("Define el regalo final:");
    if (!gift) return;
    await fetch('/save_experience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_data: currentGamedata, real_gift: gift })
    });
    window.location.href = `/experience/${window.currentGameId}`;
}

// Eventos base
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') send(); });
document.addEventListener('DOMContentLoaded', updatePreview);