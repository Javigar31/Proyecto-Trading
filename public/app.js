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
        
        // Referencias al medidor de probabilidad
        this.probText = document.getElementById('prob-text');
        this.probBar  = document.getElementById('prob-bar');

        // Manejo del selector de activo
        this.symbolSelect = document.getElementById('chart-symbol-select');
        this.activeSymbol = this.symbolSelect.value;
        this.symbolSelect.addEventListener('change', async (e) => {
            this.activeSymbol = e.target.value;
            this.chartController.clear();
            // Resetear medidor al cambiar de moneda
            this.updateProbability(0);
            
            // Hidratar gráfica con historial (Prompt 21)
            try {
                const response = await fetch(`/api/chart-history?symbol=${encodeURIComponent(this.activeSymbol)}`);
                if (response.ok) {
                    const result = await response.json();
                    if (result.status === 'success' && result.data.length > 0) {
                        this.chartController.setHistoricalData(result.data);
                    }
                }
            } catch (err) {
                console.error('Error fetching chart history:', err);
            }
        });

        this.initTerminal();
    }

    initTerminal() {
        this.logsOutput = document.getElementById('logs-output');
        this.logsOutput.innerHTML = ''; // Limpiar los placeholders de la UI
        
        this.historyOutput = document.getElementById('history-output');
        this.historyOutput.innerHTML = ''; // Limpiar placeholders
        
        this.connectSSE();
    }

    connectSSE() {
        if (this.eventSource) {
            this.eventSource.close();
        }
        
        this.eventSource = new EventSource('/api/logs');

        this.eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.message) {
                this.appendLog(data.message);
            }
            if (data.chart) {
                if (data.chart.symbol === this.activeSymbol) {
                    this.chartController.update(data.chart);
                    // Actualizar el medidor de probabilidad
                    this.updateProbability(data.chart.probability ?? 0);
                }
            }
            if (data.tradeClosed) {
                this.handleTradeClosed(data.tradeClosed);
            }
            if (data.balance !== undefined) {
                const balanceEl = document.getElementById('balance-val');
                if (balanceEl) {
                    balanceEl.textContent = `${parseFloat(data.balance).toFixed(2)} USDT`;
                }
            }
        };

        this.eventSource.onerror = (error) => {
            console.error('SSE Error:', error);
            
            // UI Resiliente: Actualizar badge en vez de reload (Prompt 17)
            if (this.statusText) {
                this.statusText.textContent = 'Reconectando panel...';
                this.statusText.style.color = 'orange';
                if (this.statusDot) this.statusDot.classList.remove('active');
            }
            
            this.appendLog('> [ERROR] Conexión con Terminal perdida. Reconectando...', 'error');
            
            // Cerrar la conexión defectuosa
            this.eventSource.close();
            
            // Reconexión silenciosa
            setTimeout(() => {
                this.connectSSE();
            }, 5000);
        };
    }

    updateProbability(value) {
        if (!this.probBar || !this.probText) return;
        const clamped = Math.max(0, Math.min(100, value));
        this.probBar.style.width = `${clamped}%`;
        this.probText.textContent = `${clamped.toFixed(2)}%`;
        if (clamped >= 80) {
            this.probBar.classList.add('hot');
            this.probText.style.color = '#4ade80';
        } else {
            this.probBar.classList.remove('hot');
            this.probText.style.color = '';
        }
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

    handleTradeClosed(trade) {
        // Update balance immediately
        if (trade.balance && document.getElementById('balance-val')) {
            document.getElementById('balance-val').textContent = `${parseFloat(trade.balance).toFixed(2)} USDT`;
        }

        if (!this.historyOutput) return;

        // Limpiar el estado de inicio si existe
        if (this.historyOutput.children.length > 0 && this.historyOutput.children[0].textContent.includes('Sin operaciones')) {
            this.historyOutput.innerHTML = '';
        }

        const isPositive = trade.profit > 0;
        const profitClass = isPositive ? 'positive' : 'negative';
        const profitSign = isPositive ? '+' : '';
        const typeClass = trade.type === 'LONG' ? 'type-long' : 'type-short';

        const card = document.createElement('div');
        card.className = 'history-card';
        card.innerHTML = `
            <div class="row-header">
                <span class="symbol">${trade.symbol}</span>
                <span class="${typeClass}">${trade.type}</span>
            </div>
            <div>
                <span class="detail-label">Entrada</span>
                <span class="detail-value">${parseFloat(trade.buyPrice).toFixed(4)}</span>
            </div>
            <div>
                <span class="detail-label">Salida</span>
                <span class="detail-value">${parseFloat(trade.sellPrice).toFixed(4)}</span>
            </div>
            <div>
                <span class="detail-label">Motivo</span>
                <span class="detail-value">${trade.reason === 'TAKE PROFIT' ? 'TP' : 'SL'}</span>
            </div>
            <div>
                <span class="detail-label">Profit</span>
                <span class="detail-value profit ${profitClass}">${profitSign}${parseFloat(trade.profit).toFixed(2)} USDT</span>
            </div>
        `;

        this.historyOutput.prepend(card);

        // Keep maximum of 50 items for UI performance
        while (this.historyOutput.children.length > 50) {
            this.historyOutput.removeChild(this.historyOutput.lastChild);
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
        // data: { symbol, time, price, signal, type? }
        this.series.update({ time: data.time, value: data.price });

        if (data.signal !== 'WAITING') {
            const isBuy = data.signal === 'BUY';
            const isShortEntry = data.signal === 'SHORT_ENTRY';
            const isTP = data.signal === 'SELL_TP';
            const isSL = data.signal === 'SELL_SL';
            
            let position, color, shape, text;
            
            if (isBuy) {
                position = 'belowBar'; color = '#22c55e'; shape = 'arrowUp'; text = 'BUY';
            } else if (isShortEntry) {
                position = 'aboveBar'; color = '#ef4444'; shape = 'arrowDown'; text = 'SHORT';
            } else {
                // EXITS
                if (data.type === 'SHORT') {
                    position = 'belowBar'; shape = 'arrowUp';
                } else {
                    position = 'aboveBar'; shape = 'arrowDown';
                }
                color = isTP ? '#22c55e' : '#ef4444';
                text = isTP ? 'TP' : 'SL';
            }
            
            let marker = { time: data.time, position, color, shape, text, size: 2 };
            this.markers.push(marker);
            this.series.setMarkers(this.markers);
        }
    }

    clear() {
        // Resetear la gráfica al cambiar de moneda
        this.series.setData([]);
        this.markers = [];
        this.series.setMarkers([]);
    }

    setHistoricalData(data) {
        // data debe ser un array de objetos { time, value }
        const sortedData = data.sort((a, b) => a.time - b.time);
        
        const uniqueData = [];
        const seenTimes = new Set();
        for (const item of sortedData) {
            if (!seenTimes.has(item.time)) {
                seenTimes.add(item.time);
                uniqueData.push(item);
            }
        }

        this.series.setData(uniqueData);
    }
}

// Inicializar el controlador principal
document.addEventListener('DOMContentLoaded', async () => {
    window.app = new DashboardController();
    
    // Sincronización de estado frontend-backend (Prompt 20)
    try {
        const response = await fetch('/api/status');
        if (response.ok) {
            const data = await response.json();
            window.app.isBotRunning = data.isRunning;
            window.app.updateUI();
            
            // Si el bot está corriendo, hidratar gráfica al cargar (Prompt 21)
            if (data.isRunning) {
                window.app.symbolSelect.dispatchEvent(new Event('change'));
            }
        }
    } catch (error) {
        console.error('Error sincronizando estado con el servidor:', error);
    }
});
