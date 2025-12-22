/**
 * DIGITAL WRAP - PLAYER ENGINE
 * Gestiona la experiencia del destinatario.
 */

let gamedata = null;
let realGift = "";
let currentStepIdx = 0;

/**
 * Inicializa el juego con los datos del servidor
 */
function initPlayer(data, gift) {
    gamedata = data;
    realGift = gift;
    renderCurrentStep();
}

/**
 * Dibuja el paso actual (Portada o Nivel)
 */
function renderCurrentStep() {
    const step = gamedata.steps[currentStepIdx];
    const quizArea = document.getElementById('quiz-area');
    const rewardArea = document.getElementById('reward-area');
    
    // Reset de la vista
    quizArea.classList.remove('hidden');
    rewardArea.classList.add('hidden');

    if (step.type === 'intro') {
        // --- RENDER PORTADA ---
        quizArea.innerHTML = `
            <div class="flex flex-col items-center justify-center min-h-[300px] text-center space-y-8 animate-fade-in">
                <div class="space-y-4">
                    <h1 class="text-3xl font-bold text-purple-400 leading-tight">${step.title}</h1>
                    <p class="text-lg text-slate-300 italic font-medium">${step.subtitle}</p>
                </div>
                <button onclick="nextStep()" class="w-full bg-purple-600 hover:bg-purple-500 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 transition-all active:scale-95">
                    Comenzar Experiencia
                </button>
            </div>
        `;
    } else {
        // --- RENDER NIVEL DE JUEGO ---
        quizArea.innerHTML = `
            <div class="flex flex-col min-h-[400px] text-left animate-fade-in">
                <div class="mb-8">
                    <span class="text-xs text-purple-500 font-mono font-bold uppercase tracking-widest leading-none">LEVEL 0${currentStepIdx}</span>
                    <h2 class="text-2xl font-bold text-purple-400 mt-2">${step.level_title}</h2>
                </div>
                
                <div class="flex-1 mb-8">
                    <p class="text-white text-lg font-medium leading-relaxed">${step.question}</p>
                </div>

                <div class="space-y-4">
                    <input type="text" id="player-answer" 
                        class="w-full bg-slate-800/50 border border-white/10 rounded-2xl py-4 px-6 outline-none focus:border-purple-500 text-white font-medium transition-all" 
                        placeholder="Escribe tu respuesta..."
                        onkeypress="if(event.key === 'Enter') checkAnswer()">
                    
                    <button onclick="checkAnswer()" class="w-full bg-purple-600 hover:bg-purple-500 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 transition-all active:scale-95">
                        Verificar Respuesta
                    </button>
                </div>
                
                <p id="error-msg" class="text-red-400 text-center text-xs font-bold mt-4 opacity-0 transition-opacity">¡Respuesta incorrecta! Inténtalo de nuevo.</p>
            </div>
        `;
    }
}

/**
 * Valida la respuesta del usuario
 */
function checkAnswer() {
    const input = document.getElementById('player-answer');
    const errorMsg = document.getElementById('error-msg');
    const userAns = input.value.trim().toLowerCase();
    const correctAns = gamedata.steps[currentStepIdx].answer.toLowerCase().trim();

    if (userAns === correctAns) {
        // Efecto visual de acierto antes de pasar
        input.classList.add('border-green-500');
        setTimeout(() => {
            if (currentStepIdx < gamedata.steps.length - 1) {
                nextStep();
            } else {
                showFinalReward();
            }
        }, 500);
    } else {
        // Efecto visual de error
        input.classList.add('border-red-500', 'animate-shake');
        errorMsg.classList.replace('opacity-0', 'opacity-100');
        
        setTimeout(() => {
            input.classList.remove('border-red-500', 'animate-shake');
        }, 500);
    }
}

function nextStep() {
    currentStepIdx++;
    renderCurrentStep();
}

/**
 * Muestra el regalo final
 */
function showFinalReward() {
    document.getElementById('quiz-area').classList.add('hidden');
    const rewardArea = document.getElementById('reward-area');
    rewardArea.classList.remove('hidden');
    document.getElementById('final-gift').innerText = realGift;
}