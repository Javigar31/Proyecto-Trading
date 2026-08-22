/**
 * Lógica del Frontend (Vanilla JS)
 * Estructurado mediante clases para evitar estado global sucio.
 */

class DashboardController {
    constructor() {
        // Estado local
        this.isBotRunning = false;
        this.isLoading = false;

        // Elementos del DOM
        this.btnToggle = document.getElementById('toggle-bot-btn');
        this.btnText = this.btnToggle.querySelector('.btn-text');
        this.btnLoader = this.btnToggle.querySelector('.btn-loader');
        
        this.statusDot = document.getElementById('status-dot');
        this.statusText = document.getElementById('status-text');

        // Bindings
        this.init();
    }

    init() {
        this.btnToggle.addEventListener('click', () => this.handleToggle());
        // Al arrancar, podríamos consultar un endpoint GET /api/status para saber si ya corría.
        // Por ahora, asumimos apagado inicial según diseño.
        this.updateUI();
    }

    async handleToggle() {
        if (this.isLoading) return;

        const endpoint = this.isBotRunning ? '/api/stop' : '/api/start';
        this.setLoading(true);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (response.ok) {
                // Actualizamos el estado de la UI según lo devuelto por el server
                this.isBotRunning = data.isBotRunning;
            } else {
                console.error('Error de API:', data.message);
                alert(`Error: ${data.message}`);
            }
        } catch (error) {
            console.error('Error de red:', error);
            alert('Error de red. No se pudo conectar con el servidor.');
        } finally {
            this.setLoading(false);
            this.updateUI();
        }
    }

    setLoading(loading) {
        this.isLoading = loading;
        this.btnToggle.disabled = loading;
        
        if (loading) {
            this.btnText.style.opacity = '0';
            this.btnLoader.classList.remove('loader-hidden');
        } else {
            this.btnText.style.opacity = '1';
            this.btnLoader.classList.add('loader-hidden');
        }
    }

    updateUI() {
        // Actualizar diseño del botón
        if (this.isBotRunning) {
            this.btnToggle.classList.add('is-running');
            this.btnText.textContent = 'DETENER BOT';
            
            // Actualizar status indicator (Verde)
            this.statusDot.classList.add('active');
            this.statusText.textContent = 'Escuchando Mercado';
            this.statusText.style.color = 'var(--color-success)';
        } else {
            this.btnToggle.classList.remove('is-running');
            this.btnText.textContent = 'INICIAR BOT';
            
            // Actualizar status indicator (Gris)
            this.statusDot.classList.remove('active');
            this.statusText.textContent = 'Desconectado';
            this.statusText.style.color = 'var(--text-primary)';
        }
    }
}

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new DashboardController();
});
