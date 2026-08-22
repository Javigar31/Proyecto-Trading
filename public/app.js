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
        this.updateUI();
        
        this.chartController = new ChartController('tv-chart');
        this.initTerminal();
    }

    initTerminal() {
        this.logsOutput = document.getElementById('logs-output');
        this.logsOutput.innerHTML = ''; // Limpiar los placeholders de la UI
        
        const eventSource = new EventSource('/api/logs');

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.message) {
                this.appendLog(data.message);
            }
            if (data.chart) {
                this.chartController.update(data.chart);
            }
        };

        eventSource.onerror = (error) => {
            console.error('SSE Error:', error);
            this.appendLog('> [ERROR] Conexión con Terminal perdida.', 'error');
        };
    }

    appendLog(message, forceColorClass = null) {
        if (!this.logsOutput) return;

        const line = document.createElement('div');
        line.className = 'log-line';

        // Mapeo semántico de colores (Prompt 04)
        if (forceColorClass) {
            line.classList.add(forceColorClass);
        } else if (message.includes('TAKE PROFIT')) {
            line.style.color = 'var(--color-success)'; // Verde
        } else if (message.includes('STOP LOSS')) {
            line.style.color = 'var(--color-danger)'; // Rojo
        } else if (message.includes('COMPRA')) {
            line.style.color = 'cyan'; // Compra en Cyan
        } else if (message.includes('Nuevo Balance Total:')) {
            line.style.color = 'gold'; // Balances en Dorado
            
            // Integración bidireccional: Actualizar el widget de balance si lo detecta el log
            const match = message.match(/([\d.]+) USDT/);
            if (match && document.getElementById('balance-val')) {
                document.getElementById('balance-val').textContent = `${parseFloat(match[1]).toFixed(2)} USDT`;
            }
        } else {
            line.classList.add('text-muted'); // Gris genérico por defecto
        }

        line.textContent = message;
        this.logsOutput.appendChild(line);

        // Auto-scroll automático manteniendo la vista abajo
        this.logsOutput.scrollTop = this.logsOutput.scrollHeight;
        
        // Prevención de fugas de memoria: Máximo 100 líneas en el DOM
        while (this.logsOutput.children.length > 100) {
            this.logsOutput.removeChild(this.logsOutput.firstChild);
        }
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

class ChartController {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        
        this.chart = LightweightCharts.createChart(this.container, {
            layout: {
                background: { type: 'solid', color: 'transparent' },
                textColor: '#94a3b8',
            },
            grid: {
                vertLines: { visible: false },
                horzLines: { visible: false },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: '#334155',
            },
            timeScale: {
                borderColor: '#334155',
                timeVisible: true,
                secondsVisible: true,
            },
        });

        this.series = this.chart.addLineSeries({
            color: '#3b82f6',
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            lineType: 0, // Solid
        });

        this.markers = [];
        
        // Resize observer para la gráfica
        new ResizeObserver(entries => {
            if (entries.length === 0 || entries[0].target !== this.container) { return; }
            const newRect = entries[0].contentRect;
            this.chart.applyOptions({ height: newRect.height, width: newRect.width });
        }).observe(this.container);
    }

    update(data) {
        // data: { time, price, signal }
        this.series.update({ time: data.time, value: data.price });

        if (data.signal !== 'WAITING') {
            let marker = {
                time: data.time,
                position: data.signal === 'BUY' ? 'belowBar' : 'aboveBar',
                color: data.signal === 'SELL_SL' ? '#ef4444' : '#22c55e',
                shape: data.signal === 'BUY' ? 'arrowUp' : 'arrowDown',
                text: data.signal === 'BUY' ? 'BUY' : (data.signal === 'SELL_TP' ? 'TP' : 'SL'),
                size: 2
            };
            this.markers.push(marker);
            this.series.setMarkers(this.markers);
        }
    }
}

// Inicializar el controlador principal
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DashboardController();
});
