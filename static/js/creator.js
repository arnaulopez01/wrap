/**
 * DIGITAL WRAP - CREATOR ENGINE (TEMPLATE + LOCAL LOADER FIX)
 * - Navegación instantánea.
 * - Lógica de plantillas locales RESTAURADA.
 * - Loader integrado en el contenedor de preview para ajustes.
 */

// 1. SINCRONIZACIÓN DE ESTADO GLOBAL
window.gamedata = window.serverData || { steps: [] }; 
window.currentStepIdx = 0; 
window.currentGameId = window.currentGameId; 

// 2. PROTOCOLO DE ARRANQUE
window.addEventListener('pageshow', (event) => {
    window.hideModal('gift-modal');
    window.hideModal('refinement-panel');

    const hasExistingGame = window.gamedata.steps && window.gamedata.steps.length > 0;

    if (hasExistingGame) {
        window.hideModal('initial-modal');
        window.initPlaytest(); 
    } else {
        window.showModal('initial-modal');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});

function setupEventListeners() {
    const ideaInput = document.getElementById('user-idea');
    if (ideaInput) {
        ideaInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') window.generateInitialGame();
        });
    }

    const themeSelector = document.getElementById('theme-selector');
    if (themeSelector) {
        themeSelector.addEventListener('change', (e) => {
            window.gamedata.theme = e.target.value;
            document.body.className = e.target.value;
            window.saveSilent();
        });
    }
}

// --- UI ENGINE: LOADER LOCAL (DENTRO DEL CONTAINER) ---
window.showLocalLoader = function() {
    const quizArea = document.getElementById('quiz-area');
    if (quizArea) {
        quizArea.innerHTML = `
            <div class="flex flex-col items-center justify-center min-h-[300px] animate-fade-in text-center">
                <div class="relative mb-6">
                    <div class="absolute inset-0 bg-purple-500/20 blur-2xl rounded-full animate-pulse"></div>
                    <i class="fa-solid fa-circle-notch animate-spin text-4xl text-purple-500 relative z-10"></i>
                </div>
                <p class="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Ajustando la realidad...</p>
            </div>`;
    }
};

// --- LOGICA DE CARGA DE PLANTILLAS LOCALES ---
async function loadLocalTemplate(filename) {
    window.hideModal('initial-modal');
    window.showLocalLoader(); // Loader local mientras carga el JSON

    try {
        const response = await fetch(`/static/plantillas/${filename}`);
        if (!response.ok) throw new Error("No se pudo cargar la plantilla local");
        
        const data = await response.json();
        window.gamedata = data;
        
        // Ejecución inmediata
        window.initPlaytest();
        window.saveSilent(); 

    } catch (e) {
        console.error("Error cargando plantilla:", e);
        window.showModal('initial-modal');
        alert("Hubo un error al cargar la plantilla.");
    }
}

// 3. GENERACIÓN POR IA / PRESETS
async function executeGeneration(prompt) {
    window.hideModal('initial-modal');
    window.showLocalLoader(); // Loader local para IA

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: prompt, current_json: window.gamedata })
        });
        const data = await response.json();
        if (data.new_json) {
            window.gamedata = data.new_json;
            window.initPlaytest();
            window.saveSilent();
        }
    } catch (e) {
        console.error("AI Error:", e);
        window.initPlaytest(); // Revertir a estado estable si falla
    }
}

window.generatePreset = function(presetKey) { 
    const templateMap = {
        'adivinanzas': 'adivinanzas.json',
        'logica': 'logica.json',
        'escape': 'escape.json',
        'detective': 'detective.json'
    };

    if (templateMap[presetKey]) {
        loadLocalTemplate(templateMap[presetKey]);
    } else {
        executeGeneration(presetKey); 
    }
};

window.generateInitialGame = function() {
    const idea = document.getElementById('user-idea')?.value.trim();
    if (idea) executeGeneration(idea);
};

// --- LOGICA DE REFINAMIENTO (AJUSTES) ---
window.refine = async function(adjustment) {
    window.hideModal('refinement-panel');
    window.showLocalLoader(); // Loader local activado para ajustes

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: `AJUSTE: ${adjustment}`, 
                current_json: window.gamedata 
            })
        });
        const data = await response.json();
        if (data.new_json) {
            window.gamedata = data.new_json;
            window.initPlaytest();
            window.saveSilent();
        }
    } catch (e) {
        console.error("Error en refinamiento:", e);
        window.initPlaytest();
    }
};

window.refineCustom = function() {
    const val = document.getElementById('refine-custom')?.value.trim();
    if (val) window.refine(val);
};

// 4. MOTOR DEL EDITOR (PREVIEW)
window.initPlaytest = function() {
    window.currentStepIdx = 0;
    window.applyVisualTheme(); 
    window.renderActiveStep();
};

window.applyVisualTheme = function() {
    const config = window.gamedata.visual_config;
    if (config) {
        const root = document.documentElement;
        root.style.setProperty('--primary', config.primary_color);
        root.style.setProperty('--bg', config.bg_color);
        root.style.setProperty('--primary-rgb', hexToRgb(config.primary_color));
        root.style.setProperty('--font-title', config.font_family);
        root.style.setProperty('--font-body', config.font_family);
        document.body.style.fontFamily = config.font_family;
        
        const iconEl = document.querySelector('#theme-icon i');
        if (iconEl && config.theme_icon) {
            iconEl.className = `fa-solid ${config.theme_icon} text-white`;
        }
        document.body.className = "dynamic-theme"; 
    }
};

window.renderActiveStep = function() {
    const quizArea = document.getElementById('quiz-area');
    if (!window.gamedata.steps) return;
    const step = window.gamedata.steps[window.currentStepIdx];
    if (!step || !quizArea) return;

    if (step.type === 'intro') {
        quizArea.innerHTML = `
            <div class="flex flex-col items-center justify-center min-h-[300px] text-center space-y-8 animate-fade-in">
                <div class="space-y-4">
                    <h1 class="text-3xl font-bold" style="color: var(--primary)">${step.title}</h1>
                    <p class="text-lg opacity-80 italic">${step.subtitle}</p>
                </div>
                <button onclick="window.nextStep()" class="w-full py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg btn-primary text-white active:scale-95 transition pointer-events-auto">
                    Probar Intro
                </button>
            </div>`;
    } else {
        quizArea.innerHTML = `
            <div class="flex flex-col text-left animate-fade-in">
                <div class="mb-6">
                    <span class="text-[10px] font-black uppercase opacity-50" style="color: var(--primary)">LEVEL 0${window.currentStepIdx} / 05</span>
                    <h2 class="text-2xl font-bold mt-1" style="color: var(--primary)">${step.level_title}</h2>
                </div>
                <p class="text-lg font-medium leading-relaxed mb-8">${step.question}</p>
                <div class="space-y-4">
                    <div class="relative">
                        <input type="text" readonly class="w-full bg-black/20 border border-white/10 rounded-2xl py-4 px-6 text-white text-center font-bold opacity-60" value="RESPUESTA: ${step.answer.toUpperCase()}">
                        <div class="absolute -top-2 -right-2 text-[8px] font-black px-2 py-1 rounded-md uppercase text-white" style="background-color: var(--primary)">Vista Creador</div>
                    </div>
                    <button onclick="window.nextStep()" class="w-full py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg btn-primary text-white active:scale-95 transition pointer-events-auto">
                        ${window.currentStepIdx < 5 ? 'Siguiente Nivel' : 'Reiniciar Demo'}
                    </button>
                </div>
            </div>`;
    }
};

window.nextStep = function() {
    window.currentStepIdx = (window.currentStepIdx < window.gamedata.steps.length - 1) ? window.currentStepIdx + 1 : 0;
    window.renderActiveStep();
};

// 5. UTILIDADES UI
window.showModal = (id) => { 
    const el = document.getElementById(id); 
    if(el) { el.classList.remove('hidden'); el.style.display = 'flex'; }
};

window.hideModal = (id) => { 
    const el = document.getElementById(id); 
    if(el) { el.classList.add('hidden'); el.style.display = 'none'; }
};

function hexToRgb(hex) {
    if (!hex) return "147, 51, 234";
    try {
        hex = hex.replace(/^#/, '');
        const bigint = parseInt(hex, 16);
        return `${(bigint >> 16) & 255}, ${(bigint >> 8) & 255}, ${bigint & 255}`;
    } catch(e) { return "147, 51, 234"; }
}

// 6. PERSISTENCIA
window.saveSilent = function() {
    fetch('/save_experience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_data: window.gamedata })
    });
};

window.openRefinement = () => window.showModal('refinement-panel');
window.closeRefinement = () => window.hideModal('refinement-panel');
window.openGiftModal = () => window.showModal('gift-modal');
window.closeGiftModal = () => window.hideModal('gift-modal');

window.confirmFinalize = async function() {
    const giftInput = document.getElementById('final-gift-input');
    const gift = giftInput?.value.trim();
    if (!gift) { giftInput?.classList.add('border-red-500', 'animate-shake'); return; }

    window.showLocalLoader(); // Loader local también para el guardado final
    try {
        await fetch('/save_experience', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game_data: window.gamedata, real_gift: gift })
        });
        window.location.href = `/demo/${window.currentGameId}`;
    } catch (e) {
        console.error("Error al finalizar");
        window.initPlaytest();
    }
};