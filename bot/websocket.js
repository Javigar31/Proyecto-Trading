const WebSocket = require('ws');
const simulator = require('./simulator');
const state = require('./state');

let wsClient = null;

function connectToBinance() {
    if (wsClient) return;

    const streams = 'btcusdt@kline_1m/btcusdt@kline_5m';
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
            const kline = {
                symbol: klineData.s,
                interval: klineData.i,
                close: klineData.c,
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
