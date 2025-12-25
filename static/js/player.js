/**
 * DIGITAL WRAP - PLAYER ENGINE (FINAL)
 * Optimizado para Gen Z: Snappy, feedback visual y transiciones fluidas.
 */

let gamedata = null;
let realGift = "";
let currentStepIdx = 0;
let isDemoMode = false;

/**
 * 1. INICIALIZACIÓN (Bootstrapping)
 */
function initPlayer(data, gift, isDemo) {
    gamedata = data;
    realGift = gift;
    isDemoMode = isDemo;

    // Aplicar identidad visual del tema
    document.body.className = gamedata.theme || 'theme-default';
    
    // Si es demo, inyectamos la marca de agua dinámicamente si no existe
    if (isDemoMode && !document.querySelector('.watermark')) {
        const wm = document.createElement('div');
        wm.className = 'watermark';
        wm.innerText = 'PREVIEW';
        document.body.appendChild(wm);
    }

    renderCurrentStep();
}

/**
 * 2. RENDERIZADO DINÁMICO
 */
function renderCurrentStep() {
    const step = gamedata.steps[currentStepIdx];
    const quizArea = document.getElementById('quiz-area');
    const rewardArea = document.getElementById('reward-area');
    
    // Transición suave: Ocultar y vaciar
    quizArea.style.opacity = '0';
    
    setTimeout(() => {
        quizArea.innerHTML = "";
        rewardArea.classList.add('hidden');

        if (step.type === 'intro') {
            renderIntro(step, quizArea);
        } else {
            renderLevel(step, quizArea);
        }
        
        quizArea.style.opacity = '1';
        quizArea.classList.add('animate-fade-in');
    }, 200);
}

function renderIntro(step, container) {
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center min-h-[350px] text-center space-y-10">
            <div class="space-y-4">
                <h1 class="text-4xl font-black leading-tight tracking-tighter" style="color: var(--primary)">
                    ${step.title}
                </h1>
                <p class="text-lg opacity-70 font-medium italic leading-relaxed">
                    ${step.subtitle}
                </p>
            </div>
            
            <button onclick="nextStep()" class="w-full py-5 rounded-[2rem] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 btn-primary text-white text-lg">
                Empezar Reto
            </button>
        </div>
    `;
}

function renderLevel(step, container) {
    container.innerHTML = `
        <div class="flex flex-col min-h-[400px] text-left">
            <div class="mb-8 flex justify-between items-end">
                <div>
                    <span class="text-[10px] font-black uppercase tracking-[0.3em] opacity-50" style="color: var(--primary)">
                        Nivel 0${currentStepIdx} / 05
                    </span>
                    <h2 class="text-2xl font-black mt-1" style="color: var(--primary)">${step.level_title}</h2>
                </div>
                <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                    <i class="fa-solid fa-puzzle-piece text-xs opacity-30"></i>
                </div>
            </div>
            
            <div class="flex-1 mb-10">
                <p class="text-xl font-semibold leading-relaxed text-balance">${step.question}</p>
            </div>

            <div class="space-y-4">
                <input type="text" id="player-answer" autocomplete="off" spellcheck="false"
                    class="w-full bg-black/20 border-2 border-white/5 rounded-2xl py-5 px-6 outline-none focus:border-purple-500 text-white font-bold text-center text-lg transition-all" 
                    placeholder="Escribe aquí..."
                    onkeypress="if(event.key === 'Enter') checkAnswer()">
                
                <button onclick="checkAnswer()" class="w-full py-5 rounded-2xl font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95 btn-primary text-white">
                    Verificar
                </button>
            </div>
            
            <p id="error-msg" class="text-red-400 text-center text-[10px] font-black uppercase tracking-widest mt-6 opacity-0 transition-opacity">
                Respuesta incorrecta. ¡Prueba otra vez!
            </p>
        </div>
    `;
    // Foco automático para UX rápida en desktop
    setTimeout(() => document.getElementById('player-answer')?.focus(), 300);
}

/**
 * 3. LÓGICA DE VALIDACIÓN (Engine)
 */
function checkAnswer() {
    const input = document.getElementById('player-answer');
    const errorMsg = document.getElementById('error-msg');
    const userAns = input.value.trim().toLowerCase();
    const correctAns = gamedata.steps[currentStepIdx].answer.toLowerCase().trim();

    // Normalización básica de tildes para evitar frustración Gen Z
    const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (normalize(userAns) === normalize(correctAns)) {
        // SUCCESS
        input.classList.remove('border-white/5');
        input.classList.add('border-green-500', 'bg-green-500/10');
        input.disabled = true;
        
        // Haptic-like feedback visual
        const container = document.getElementById('game-container');
        container.classList.add('scale-105');
        setTimeout(() => container.classList.remove('scale-105'), 200);

        setTimeout(() => {
            if (currentStepIdx < gamedata.steps.length - 1) {
                nextStep();
            } else {
                showFinalReward();
            }
        }, 600);
    } else {
        // FAIL
        input.classList.add('animate-shake', 'border-red-500');
        errorMsg.classList.replace('opacity-0', 'opacity-100');
        
        setTimeout(() => {
            input.classList.remove('animate-shake', 'border-red-500');
            input.value = ""; // Limpiamos para el re-intento
        }, 500);
    }
}

function nextStep() {
    currentStepIdx++;
    renderCurrentStep();
}

/**
 * 4. RECOMPENSA FINAL (The Big Moment)
 */
function showFinalReward() {
    const quizArea = document.getElementById('quiz-area');
    const rewardArea = document.getElementById('reward-area');
    const giftText = document.getElementById('final-gift');
    
    quizArea.classList.add('hidden');
    rewardArea.classList.remove('hidden');

    if (isDemoMode) {
        // --- PANTALLA DE CONVERSIÓN (MODO DEMO) ---
        rewardArea.innerHTML = `
            <div class="text-center space-y-8 py-4 animate-fade-in">
                <div class="relative w-24 h-24 mx-auto">
                    <div class="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full animate-pulse"></div>
                    <div class="relative w-24 h-24 bg-amber-500/10 rounded-[2rem] border border-amber-500/20 flex items-center justify-center">
                        <i class="fa-solid fa-lock text-amber-500 text-4xl"></i>
                    </div>
                </div>

                <div class="space-y-2">
                    <h2 class="text-3xl font-black uppercase tracking-tighter">¡Reto Superado!</h2>
                    <p class="text-slate-400 text-sm font-medium">Has completado la demo. El regalo real está bloqueado hasta que se confirme el pago.</p>
                </div>
                
                <div class="p-8 bg-white/5 rounded-[2.5rem] border-2 border-dashed border-white/10 blur-[4px] select-none scale-95 opacity-50">
                    <p class="text-xl font-black uppercase tracking-widest">REGALO SECRETO</p>
                </div>

                <div class="pt-6 space-y-4">
                    <a href="/pay/${window.currentGameId || ''}" class="block w-full bg-green-500 hover:bg-green-400 py-5 rounded-2xl font-black uppercase tracking-widest shadow-[0_20px_40px_rgba(34,197,94,0.3)] transition-all active:scale-95 text-white">
                        Desbloquear Regalo (1,99€)
                    </a>
                    <p class="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">Enlace permanente + QR incluido</p>
                </div>
            </div>
        `;
    } else {
        // --- PANTALLA FINAL (REGALO DESBLOQUEADO) ---
        giftText.innerText = realGift || "¡Felicidades por completar el reto!";
        // Aquí podrías disparar un efecto de confeti
        console.log("¡Experiencia completada con éxito!");
    }
}

/**
 * 5. UTILIDADES UI
 */
window.nextStep = nextStep; // Hacer accesible globalmente para el Creator