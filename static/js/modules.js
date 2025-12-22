/**
 * Lógica de Módulos y Minijuegos para Digital Wrap
 */

const MODULE_CONFIG = {
    'quiz': { name: 'Quiz Rápido', plan: 'quiz', icon: 'fa-question-circle', desc: 'Preguntas de respuesta directa.' },
    'adivinanza': { name: 'Adivinanza', plan: 'quiz', icon: 'fa-brain', desc: 'Acertijos clásicos con pista.' },
    'sudoku': { name: 'Mini Sudoku', plan: 'gymkhana', icon: 'fa-table-cells', desc: 'Tablero 4x4 interactivo.' },
    'queens': { name: 'Reinas Ajedrez', plan: 'gymkhana', icon: 'fa-chess-queen', desc: 'Reto de lógica en tablero.' },
    'escape': { name: 'Mini Escape', plan: 'escape', icon: 'fa-key', desc: 'Desafío de códigos y pistas.' }
};

const PLAN_RANK = { 'quiz': 1, 'gymkhana': 2, 'escape': 3 };

/**
 * Abre el selector de módulos (Modal)
 */
function openModuleSelector() {
    const currentPlan = document.getElementById('product-selector').value;
    
    let optionsHtml = Object.entries(MODULE_CONFIG).map(([key, cfg]) => {
        const isLocked = PLAN_RANK[currentPlan] < PLAN_RANK[cfg.plan];
        return `
            <div onclick="applyModule('${key}')" class="flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 cursor-pointer transition-all border border-white/5 group">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-all">
                        <i class="fa-solid ${cfg.icon} text-purple-400"></i>
                    </div>
                    <div>
                        <p class="font-bold text-sm text-white">${cfg.name}</p>
                        <p class="text-[9px] uppercase text-slate-500 tracking-widest">${cfg.plan}</p>
                    </div>
                </div>
                ${isLocked ? '<i class="fa-solid fa-lock text-amber-400 animate-pulse"></i>' : '<i class="fa-solid fa-chevron-right text-slate-600"></i>'}
            </div>
        `;
    }).join('');

    const overlay = document.createElement('div');
    overlay.id = "module-overlay";
    overlay.className = "absolute inset-0 z-50 bg-[#020617]/95 backdrop-blur-md p-8 flex flex-col items-center justify-center";
    overlay.innerHTML = `
        <div class="w-full max-w-sm">
            <div class="flex justify-between items-center mb-6">
                <h3 class="font-bold uppercase tracking-widest text-xs text-purple-400">Seleccionar Módulo</h3>
                <button onclick="this.closest('#module-overlay').remove()" class="text-slate-500 hover:text-white transition-colors">
                    <i class="fa-solid fa-xmark text-xl"></i>
                </button>
            </div>
            <div class="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scroll">
                ${optionsHtml}
            </div>
        </div>
    `;
    document.getElementById('game-preview').appendChild(overlay);
}

/**
 * Carga la plantilla JSON del módulo y la aplica al estado actual
 */
async function applyModule(moduleType) {
    const config = MODULE_CONFIG[moduleType];
    const selector = document.getElementById('product-selector');
    const currentPlan = selector.value;

    // Verificar Upgrade de Plan
    if (PLAN_RANK[currentPlan] < PLAN_RANK[config.plan]) {
        const confirmUpgrade = confirm(`El módulo "${config.name}" requiere el plan ${config.plan.toUpperCase()}. ¿Deseas actualizar tu experiencia?`);
        if (confirmUpgrade) {
            selector.value = config.plan;
        } else {
            return;
        }
    }

    try {
        const response = await fetch(`/static/js/plantillas/${moduleType}.json`);
        if (!response.ok) throw new Error("Plantilla no encontrada");
        
        const templateData = await response.json();
        
        // Inyectar en el estado global (que vive en creator.js)
        currentGamedata.steps[activeLevel] = {
            ...currentGamedata.steps[activeLevel],
            ...templateData,
            module: moduleType
        };
        
        // Eliminar modal y refrescar preview
        const overlay = document.getElementById('module-overlay');
        if (overlay) overlay.remove();
        
        updatePreview();
        saveToDB();
    } catch (e) {
        console.error("Error al cargar módulo:", e);
        alert("Lo siento, este módulo no está disponible todavía.");
    }
}