/**
 * DIGITAL WRAP - CREATOR ENGINE (TOTAL FIX)
 * Este script asume que player.js ya ha sido cargado.
 */

// 1. SINCRONIZACIÓN DE ESTADO GLOBAL
// No usamos 'let' porque ya están declaradas en player.js
currentGamedata = window.serverData || null;
currentGameId = window.currentGameId;
currentStepIdx = 0; 

// 2. INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Creator Engine: Sistema cargado y listo.");
    
    // Si la experiencia está vacía, forzamos el modal de idea
    if (!currentGamedata.steps || currentGamedata.steps.length === 0 || currentGamedata.steps[1]?.question === "Pregunta...") {
        window.showModal('initial-modal');
    } else {
        window.hideModal('initial-modal');
        window.initPlaytest();
    }

    // Configuración del selector de temas
    const themeSelector = document.getElementById('theme-selector');
    if (themeSelector) {
        themeSelector.value = currentGamedata.theme || 'theme-default';
        themeSelector.addEventListener('change', (e) => {
            currentGamedata.theme = e.target.value;
            window.applyVisualTheme();
            window.saveSilent();
        });
    }
});

// 3. GENERACIÓN INICIAL (LLAMADA A IA)
window.generateInitialGame = async function() {
    const ideaEl = document.getElementById('user-idea');
    const idea = ideaEl ? ideaEl.value.trim() : "";
    
    if (!idea) {
        ideaEl.classList.add('animate-shake', 'border-red-500');
        setTimeout(() => ideaEl.classList.remove('animate-shake', 'border-red-500'), 500);
        return;
    }

    console.log("📡 Generando para:", idea);
    window.showLoading("Invocando la magia...");
    window.hideModal('initial-modal');

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Crea un Mini Escape Room completo basado en esta idea: ${idea}`,
                current_json: currentGamedata
            })
        });

        const data = await response.json();
        
        if (data.new_json) {
            currentGamedata = data.new_json;
            setTimeout(() => {
                window.hideLoading();
                window.initPlaytest();
            }, 1000);
        }
    } catch (e) {
        console.error("Error IA:", e);
        window.hideLoading();
        window.showModal('initial-modal');
        alert("Hubo un error al conectar con la IA. Prueba de nuevo.");
    }
};

// 4. MOTOR DE PLAYTEST (MODO CREADOR)
window.initPlaytest = function() {
    currentStepIdx = 0;
    window.applyVisualTheme();
    window.renderActiveStep();
};

window.applyVisualTheme = function() {
    const theme = currentGamedata.theme || 'theme-default';
    document.body.className = theme;
    
    const iconEl = document.querySelector('#theme-icon i');
    if (iconEl) {
        const icons = {
            'theme-navidad': 'fa-tree',
            'theme-san-valentin': 'fa-heart',
            'theme-cumpleanos': 'fa-cake-candles',
            'theme-hacker': 'fa-terminal',
            'theme-aventura': 'fa-compass',
            'theme-default': 'fa-wand-magic-sparkles'
        };
        iconEl.className = `fa-solid ${icons[theme] || icons['theme-default']}`;
    }
};

window.renderActiveStep = function() {
    const step = currentGamedata.steps[currentStepIdx];
    const quizArea = document.getElementById('quiz-area');
    if (!step) return;

    if (step.type === 'intro') {
        quizArea.innerHTML = `
            <div class="flex flex-col items-center justify-center min-h-[300px] text-center space-y-8 animate-fade-in">
                <div class="space-y-4">
                    <h1 class="text-3xl md:text-4xl font-bold" style="color: var(--primary)">${step.title}</h1>
                    <p class="text-lg opacity-80 italic font-medium">${step.subtitle}</p>
                </div>
                <button onclick="nextStep()" class="w-full py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg btn-primary text-white active:scale-95 transition">
                    Probar Intro
                </button>
            </div>
        `;
    } else {
        quizArea.innerHTML = `
            <div class="flex flex-col text-left animate-fade-in">
                <div class="mb-6">
                    <span class="text-[10px] font-black uppercase tracking-widest opacity-50" style="color: var(--primary)">LEVEL 0${currentStepIdx} / 05</span>
                    <h2 class="text-2xl font-bold mt-1" style="color: var(--primary)">${step.level_title}</h2>
                </div>
                <p class="text-lg font-medium leading-relaxed mb-8">${step.question}</p>
                <div class="space-y-4">
                    <div class="relative">
                        <input type="text" readonly 
                            class="w-full bg-black/20 border border-white/10 rounded-2xl py-4 px-6 text-white text-center font-bold opacity-60" 
                            value="RESPUESTA: ${step.answer.toUpperCase()}">
                        <div class="absolute -top-2 -right-2 bg-purple-600 text-[8px] font-black px-2 py-1 rounded-md uppercase tracking-tighter">Vista Creador</div>
                    </div>
                    <button onclick="nextStep()" class="w-full py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg btn-primary text-white active:scale-95 transition">
                        ${currentStepIdx < 5 ? 'Siguiente Nivel' : 'Reiniciar Demo'}
                    </button>
                </div>
            </div>
        `;
    }
};

window.nextStep = function() {
    if (currentStepIdx < currentGamedata.steps.length - 1) {
        currentStepIdx++;
    } else {
        currentStepIdx = 0;
    }
    window.renderActiveStep();
};

// 5. AJUSTES (REFINAMIENTO)
window.openRefinement = () => window.showModal('refinement-panel');
window.closeRefinement = () => window.hideModal('refinement-panel');

window.refine = async function(adjustment) {
    window.closeRefinement();
    window.showLoading(`Haciéndolo ${adjustment.toLowerCase()}...`);

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `AJUSTE: ${adjustment}`,
                current_json: currentGamedata
            })
        });
        const data = await response.json();
        if (data.new_json) {
            currentGamedata = data.new_json;
            setTimeout(() => {
                window.hideLoading();
                window.initPlaytest();
            }, 1000);
        }
    } catch (e) {
        window.hideLoading();
    }
};

window.refineCustom = function() {
    const val = document.getElementById('refine-custom').value.trim();
    if (val) window.refine(val);
};

// 6. FINALIZACIÓN
window.openGiftModal = () => window.showModal('gift-modal');
window.closeGiftModal = () => window.hideModal('gift-modal');

window.confirmFinalize = async function() {
    const giftInput = document.getElementById('final-gift-input');
    const gift = giftInput ? giftInput.value.trim() : "";
    
    if (!gift) {
        giftInput.classList.add('border-red-500', 'animate-shake');
        return;
    }

    window.showLoading("Sellando tu Digital Wrap...");

    try {
        await fetch('/save_experience', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                game_data: currentGamedata,
                real_gift: gift
            })
        });
        window.location.href = `/demo/${currentGameId}`;
    } catch (e) {
        window.hideLoading();
        alert("Error al guardar. Reintenta.");
    }
};

// 7. UTILIDADES UI
window.showModal = (id) => {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('hidden');
        el.style.display = 'flex';
    }
};

window.hideModal = (id) => {
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('hidden');
        el.style.display = 'none';
    }
};

window.showLoading = (text) => {
    const overlay = document.getElementById('loading-overlay');
    const textEl = document.getElementById('loading-text');
    if (textEl) textEl.innerText = text;
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
};

window.hideLoading = () => {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.add('hidden');
    overlay.style.display = 'none';
};

window.saveSilent = function() {
    fetch('/save_experience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_data: currentGamedata })
    });
};