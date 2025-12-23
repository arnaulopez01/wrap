/**
 * DIGITAL WRAP - LANDING LOGIC
 * Gestiona animaciones, selección de planes y preventa del modo Premium.
 */

document.addEventListener('DOMContentLoaded', () => {
    initScrollAnimations();
    initPricingLogic();
});

/**
 * 1. ANIMACIONES DE ENTRADA (Intersection Observer)
 * Hace que los elementos aparezcan suavemente al hacer scroll.
 */
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('opacity-100', 'translate-y-0');
                entry.target.classList.remove('opacity-0', 'translate-y-10');
                observer.unobserve(entry.target); // Solo animar una vez
            }
        });
    }, observerOptions);

    // Seleccionamos secciones y tarjetas para animar
    const animateElements = document.querySelectorAll('.reveal');
    animateElements.forEach(el => {
        el.classList.add('transition-all', 'duration-700', 'ease-out', 'opacity-0', 'translate-y-10');
        observer.observe(el);
    });
}

/**
 * 2. LÓGICA DE PRECIOS Y PLANES
 */
function initPricingLogic() {
    const miniPlanBtn = document.getElementById('btn-choose-mini');
    const premiumPlanBtn = document.getElementById('btn-notify-premium');

    if (miniPlanBtn) {
        miniPlanBtn.addEventListener('click', () => {
            // Animación de salida y redirección
            miniPlanBtn.innerHTML = '<i class="fa-solid fa-circle-notch animate-spin"></i>';
            window.location.href = '/templates';
        });
    }

    if (premiumPlanBtn) {
        premiumPlanBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showPremiumModal();
        });
    }
}

/**
 * 3. MODAL DE "AVISARME" (PREVENTA PREMIUM)
 * En lugar de enviarlos a una página de error, capturamos su interés.
 */
function showPremiumModal() {
    // Creamos un modal sencillo dinámicamente
    const modalHtml = `
        <div id="premium-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div class="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] max-w-sm w-full text-center space-y-6 shadow-2xl">
                <div class="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto">
                    <i class="fa-solid fa-rocket text-purple-400 text-2xl"></i>
                </div>
                <div class="space-y-2">
                    <h3 class="text-2xl font-bold">Modo Premium</h3>
                    <p class="text-slate-400 text-sm">Estamos puliendo acertijos épicos, sudokus y lógica avanzada. Estará listo muy pronto.</p>
                </div>
                <div class="space-y-3">
                    <input type="email" id="premium-email" placeholder="Tu email" 
                           class="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-purple-500 transition-all text-sm">
                    <button onclick="subscribePremium()" class="w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-xl font-bold text-sm transition-all">
                        ¡Avisadme cuando salga!
                    </button>
                </div>
                <button onclick="closeModal()" class="text-xs text-slate-500 hover:text-white uppercase tracking-widest font-bold">Cerrar</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeModal() {
    const modal = document.getElementById('premium-modal');
    if (modal) modal.remove();
}

/**
 * 4. SIMULACIÓN DE CAPTURA DE LEADS
 */
function subscribePremium() {
    const email = document.getElementById('premium-email').value;
    if (!email || !email.includes('@')) {
        alert("Por favor, introduce un email válido.");
        return;
    }

    // Aquí podrías hacer un fetch a una ruta de Flask para guardar el email
    console.log("Email capturado para Premium:", email);
    
    const modalContent = document.querySelector('#premium-modal > div');
    modalContent.innerHTML = `
        <div class="space-y-4 py-4 animate-fade-in">
            <i class="fa-solid fa-circle-check text-green-500 text-5xl"></i>
            <h3 class="text-2xl font-bold">¡Anotado!</h3>
            <p class="text-slate-400 text-sm">Te avisaremos antes que a nadie y recibirás un descuento especial por el lanzamiento.</p>
            <button onclick="closeModal()" class="w-full bg-white/5 py-3 rounded-xl font-bold text-sm">Genial</button>
        </div>
    `;
}