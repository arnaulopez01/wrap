/**
 * DIGITAL WRAP - PARTICLE ENGINE
 * Genera efectos visuales dinámicos según el tema.
 */

class ParticleEngine {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.theme = 'theme-default';
        this.init();
    }

    init() {
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '1';
        document.body.appendChild(this.canvas);

        window.addEventListener('resize', () => this.resize());
        this.resize();
        this.loop();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    updateTheme(newTheme) {
        this.theme = newTheme;
        this.particles = []; // Limpiar al cambiar tema
        const count = this.theme === 'theme-hacker' ? 50 : 40;
        
        for (let i = 0; i < count; i++) {
            this.particles.push(this.createParticle());
        }
    }

    createParticle() {
        return {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            size: Math.random() * 5 + 2,
            speedY: Math.random() * 1 + 0.5,
            speedX: (Math.random() - 0.5) * 0.5,
            char: this.getThemeChar(),
            opacity: Math.random() * 0.5 + 0.2
        };
    }

    getThemeChar() {
        if (this.theme === 'theme-navidad') return '❄';
        if (this.theme === 'theme-san-valentin') return '❤';
        if (this.theme === 'theme-hacker') return Math.random() > 0.5 ? '1' : '0';
        if (this.theme === 'theme-cumpleanos') return '✨';
        return '•';
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.particles.forEach(p => {
            this.ctx.globalAlpha = p.opacity;
            this.ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#ffffff';
            
            if (this.theme === 'theme-hacker') {
                this.ctx.font = '14px monospace';
                this.ctx.fillText(p.char, p.x, p.y);
            } else {
                this.ctx.font = `${p.size * 3}px serif`;
                this.ctx.fillText(p.char, p.x, p.y);
            }

            p.y += p.speedY;
            p.x += p.speedX;

            if (p.y > this.canvas.height) p.y = -20;
            if (p.x > this.canvas.width) p.x = 0;
            if (p.x < 0) p.x = this.canvas.width;
        });
    }

    loop() {
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

// Inicializar globalmente
window.particles = new ParticleEngine();