const WebSocket = require('ws');
const simulator = require('./simulator');
const { state, WHITELIST } = require('./state');

let wsClient = null;

function connectToBinance() {
    if (wsClient) return;

    // Construir streams para cada símbolo en la WHITELIST
    const streamPaths = WHITELIST.map(sym => {
        const base = sym.replace('/', '').toLowerCase();
        return `${base}@kline_1m/${base}@kline_5m`;
    });
    const streams = streamPaths.join('/');
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    wsClient = new WebSocket(wsUrl);

    wsClient.on('open', () => {
        console.log('[WS] Conectado a Binance Streams.');
        state.emit('log', '> WebSocket conectado. Escuchando klines de 1m y 5m...');
    });

    wsClient.on('message', (data) => {
        try {
            const payload = JSON.parse(data);
            if (!payload.data || !payload.data.k) return;

            const klineData = payload.data.k;
            // Mapear "SOLUSDT" a "SOL/USDT"
            const symbol = klineData.s.replace(/^(.+)(USDT)$/, '$1/USDT');
            
            const kline = {
                symbol: symbol,
                time: Math.floor(klineData.t / 1000),
                interval: klineData.i,
                close: klineData.c,
                open: klineData.o,
                high: klineData.h,
                low: klineData.l,
                volume: klineData.v,
                isClosed: klineData.x
            };

            simulator.processTick(kline);
        } catch (error) {
            console.error('[WS] Error parseando mensaje:', error);
        }
    });

    wsClient.on('error', (err) => {
        console.error('[WS] Error:', err);
        state.emit('log', `> [WS ERROR] ${err.message}`);
    });

    wsClient.on('close', () => {
        console.log('[WS] Conexión cerrada.');
        wsClient = null;
        
        // Auto-reconexión si el bot sigue corriendo
        if (state.isBotRunning) {
            console.log('[WS] Reconectando en 5s...');
            state.emit('log', '> [SISTEMA] Reconectando a Binance WebSockets...');
            setTimeout(connectToBinance, 5000);
        }
    });
}

function disconnectFromBinance() {
    if (wsClient) {
        // Para no auto-reconectar, aseguramos que el estado esté apagado antes de llamar aquí
        wsClient.close();
        wsClient = null;
        console.log('[WS] Desconectado manualmente.');
    }
}

module.exports = {
    connectToBinance,
    disconnectFromBinance
};
