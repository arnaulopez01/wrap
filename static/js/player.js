// Variables de estado del juego
let currentStep = 0;
let gameData = null;
let realGift = "";

// Inicialización del juego
function initPlayer(data, gift) {
    gameData = data;
    realGift = gift;
    loadStep();
}

// Cargar el paso/pregunta actual
function loadStep() {
    if (!gameData) return;
    
    document.getElementById('game-title').innerText = gameData.title;
    document.getElementById('question-text').innerText = gameData.steps[currentStep].question;
    document.getElementById('answer-input').value = ""; // Limpiar input en cada paso
}

// Verificar la respuesta del usuario
function checkAnswer() {
    const inputEl = document.getElementById('answer-input');
    const userAns = inputEl.value.toLowerCase().trim();
    const correctAns = gameData.steps[currentStep].answer.toLowerCase().trim();

    if (userAns === correctAns) {
        currentStep++;
        if (currentStep < gameData.steps.length) {
            loadStep();
        } else {
            showReward();
        }
    } else {
        alert("¡Respuesta incorrecta! Inténtalo de nuevo.");
        inputEl.focus();
    }
}

// Mostrar la recompensa final
function showReward() {
    document.getElementById('quiz-area').classList.add('hidden');
    document.getElementById('reward-area').classList.remove('hidden');
    document.getElementById('final-gift').innerText = realGift;
}

// Escuchar la tecla Enter para verificar respuesta
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('answer-input');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkAnswer();
        });
    }
});