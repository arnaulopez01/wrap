/**
 * DIGITAL WRAP - PLAYER ENGINE (MVP Version)
 * Gestiona la experiencia del destinatario y el modo Demo.
 */

let gamedata = null;
let realGift = "";
let currentStepIdx = 0;
let isDemoMode = false;

/**
 * Inicializa el juego con los datos del servidor
 * @param {Object} data - El JSON de la experiencia
 * @param {String} gift - El texto del regalo final
 * @param {Boolean} isDemo - Flag para activar marca de agua/bloqueo
 */
function initPlayer(data, gift, isDemo) {
    gamedata = data;
    realGift = gift;
    isDemoMode = isDemo;

    // 1. Aplicar el tema visual (Navidad, San Valentín, etc.)
    document.body.className = gamedata.theme || 'theme-default';

    // 2. Si es demo, podríamos añadir una marca de agua visual por JS si no está en HTML
    if (isDemoMode) {
        console.log("Modo Demo Activo: El regalo estará bloqueado al final.");
    }

    renderCurrentStep();
}

/**
 * Dibuja el paso actual (Portada o Nivel)
 */
function renderCurrentStep() {
    const step = gamedata.steps[currentStepIdx];
    const quizArea = document.getElementById('quiz-area');
    const rewardArea = document.getElementById('reward-area');
    
    // Reset de vistas
    quizArea.classList.remove('hidden');
    rewardArea.classList.add('hidden');
    quizArea.innerHTML = ""; // Limpieza

    if (step.type === 'intro') {
        renderPortada(step, quizArea);
    } else {
        renderNivel(step, quizArea);
    }
}

function renderPortada(step, container) {
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center min-h-[350px] text-center space-y-8 animate-fade-in">
            <div class="space-y-4">
                <h1 class="text-3xl md:text-4xl font-bold leading-tight" style="color: var(--primary)">${step.title}</h1>
                <p class="text-lg opacity-80 italic font-medium">${step.subtitle}</p>
            </div>
            <button onclick="nextStep()" class="w-full py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 btn-primary text-white">
                Comenzar Experiencia
            </button>
        </div>
    `;
}

function renderNivel(step, container) {
    container.innerHTML = `
        <div class="flex flex-col min-h-[400px] text-left animate-fade-in">
            <div class="mb-8">
                <span class="text-xs font-mono font-bold uppercase tracking-widest leading-none" style="color: var(--primary)">LEVEL 0${currentStepIdx}</span>
                <h2 class="text-2xl font-bold mt-2" style="color: var(--primary)">${step.level_title}</h2>
            </div>
            
            <div class="flex-1 mb-8">
                <p class="text-lg font-medium leading-relaxed">${step.question}</p>
            </div>

            <div class="space-y-4">
                <input type="text" id="player-answer" autocomplete="off"
                    class="w-full bg-black/20 border border-white/10 rounded-2xl py-4 px-6 outline-none focus:border-purple-500 text-white font-medium transition-all" 
                    placeholder="Escribe tu respuesta..."
                    onkeypress="if(event.key === 'Enter') checkAnswer()">
                
                <button onclick="checkAnswer()" class="w-full py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 btn-primary text-white">
                    Verificar Respuesta
                </button>
            </div>
            
            <p id="error-msg" class="text-red-400 text-center text-xs font-bold mt-4 opacity-0 transition-opacity">¡Respuesta incorrecta! Inténtalo de nuevo.</p>
        </div>
    `;
    document.getElementById('player-answer').focus();
}

/**
 * Valida la respuesta
 */
function checkAnswer() {
    const input = document.getElementById('player-answer');
    const errorMsg = document.getElementById('error-msg');
    const userAns = input.value.trim().toLowerCase();
    const correctAns = gamedata.steps[currentStepIdx].answer.toLowerCase().trim();

    if (userAns === correctAns) {
        input.classList.add('border-green-500');
        input.disabled = true;
        setTimeout(() => {
            if (currentStepIdx < gamedata.steps.length - 1) {
                nextStep();
            } else {
                showFinalReward();
            }
        }, 600);
    } else {
        input.classList.add('animate-shake', 'border-red-500');
        errorMsg.classList.replace('opacity-0', 'opacity-100');
        setTimeout(() => {
            input.classList.remove('animate-shake', 'border-red-500');
        }, 500);
    }
}

function nextStep() {
    currentStepIdx++;
    renderCurrentStep();
}

/**
 * Muestra el regalo o el bloqueo de Demo
 */
function showFinalReward() {
    document.getElementById('quiz-area').classList.add('hidden');
    const rewardArea = document.getElementById('reward-area');
    const giftText = document.getElementById('final-gift');
    
    rewardArea.classList.remove('hidden');

    if (isDemoMode) {
        // --- ESTADO DEMO (BLOQUEADO) ---
        rewardArea.innerHTML = `
            <div class="text-center space-y-6 py-6 animate-fade-in">
                <div class="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fa-solid fa-lock text-amber-500 text-3xl"></i>
                </div>
                <h2 class="text-3xl font-black uppercase tracking-tighter">¡Demo Completada!</h2>
                <p class="text-slate-400 text-sm">Has llegado al final de la vista previa. El regalo real está oculto tras este panel.</p>
                
                <div class="p-6 bg-white/5 rounded-3xl border-2 border-dashed border-white/10 blur-[2px] select-none">
                    <p class="text-xl font-bold opacity-20">ESTE ES UN REGALO SECRETO</p>
                </div>

                <div class="pt-4 space-y-3">
                    <a href="/pay/${window.currentGameId || ''}" class="block w-full bg-green-600 hover:bg-green-500 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all">
                        Desbloquear Regalo (1,99€)
                    </a>
                    <p class="text-[10px] text-slate-500 uppercase tracking-widest">Recibirás un link permanente y un código QR</p>
                </div>
            </div>
        `;
    } else {
        // --- ESTADO FINAL (PAGADO) ---
        giftText.innerText = realGift || "¡Felicidades por completar el reto!";
    }
}