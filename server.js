require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { state } = require('./bot/state');
const simulator = require('./bot/simulator');
const { connectToBinance, disconnectFromBinance } = require('./bot/websocket');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // TODO: Restringir a localhost en prod si aplica
app.use(express.json());

// Servir frontend estático
app.use(express.static(path.join(__dirname, 'public')));

// Endpoints de control
app.post('/api/start', async (req, res) => {
    if (state.isBotRunning || state.isWarmingUp) {
        return res.status(400).json({
            status: 'error',
            message: 'El bot ya está en ejecución o inicializándose.',
            isBotRunning: state.isBotRunning
        });
    }

    try {
        state.isWarmingUp = true;
        // Fase de calentamiento (REST)
        await simulator.warmup();
        
        // Si el warmup es exitoso, marcamos como corriendo e iniciamos el stream
        state.isBotRunning = true;
        state.isWarmingUp = false;
        connectToBinance();
        console.log('[API] Bot INICIADO por el usuario.');

        return res.json({
            status: 'success',
            message: 'Bot iniciado correctamente.',
            isBotRunning: state.isBotRunning
        });
    } catch (error) {
        state.isWarmingUp = false;
        return res.status(500).json({
            status: 'error',
            message: 'Error al inicializar el bot (Warmup falló).',
            error: error.message
        });
    }
});

app.post('/api/stop', (req, res) => {
    if (!state.isBotRunning) {
        return res.status(400).json({
            status: 'error',
            message: 'El bot ya está detenido.',
            isBotRunning: state.isBotRunning
        });
    }

    state.isBotRunning = false;
    console.log('[API] Bot DETENIDO por el usuario.');
    
    // Detener la conexión de WebSocket
    disconnectFromBinance();

    return res.json({
        status: 'success',
        message: 'Bot detenido correctamente.',
        isBotRunning: state.isBotRunning
    });
});

// Endpoint para sincronización de estado frontend-backend (Prompt 20)
app.get('/api/status', (req, res) => {
    res.json({ isRunning: state.isBotRunning });
});

// Endpoint SSE para la Terminal Holográfica
app.get('/api/logs', (req, res) => {
    // Configurar cabeceras obligatorias para Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); 

    // Callback para enviar mensajes al cliente
    const onLog = (message) => {
        res.write(`data: ${JSON.stringify({ message })}\n\n`);
    };

    const onChart = (data) => {
        res.write(`data: ${JSON.stringify({ chart: data })}\n\n`);
    };

    const onTradeClosed = (data) => {
        res.write(`data: ${JSON.stringify({ tradeClosed: data })}\n\n`);
    };

    // Suscribir al EventEmitter del estado global
    state.on('log', onLog);
    state.on('chart_data', onChart);
    state.on('trade_closed', onTradeClosed);
    
    // Heartbeat Keep-Alive cada 30 segundos
    const keepAlive = setInterval(() => {
        res.write(':\n\n'); // Comentario SSE para mantener viva la conexión
    }, 30000);
    
    // Enviar mensaje de conexión y el balance actual al cliente de inmediato
    res.write(`data: ${JSON.stringify({ message: '> Conexión SSE establecida con la Terminal Holográfica.' })}\n\n`);
    res.write(`data: ${JSON.stringify({ balance: state.virtualBalance })}\n\n`);

    // Prevención de fugas de memoria: Limpiar al desconectar
    req.on('close', () => {
        clearInterval(keepAlive);
        state.removeListener('log', onLog);
        state.removeListener('chart_data', onChart);
        state.removeListener('trade_closed', onTradeClosed);
    });
});

const db = require('./bot/db');

// Inicio del servidor HTTP
app.listen(PORT, async () => {
    try {
        await db.initDB();
        state.virtualBalance = await db.getBalance();
        console.log(`[DB] Balance inicial cargado en el estado: ${state.virtualBalance} USDT`);
    } catch (error) {
        console.error('[SERVER] Error al inicializar la base de datos en el arranque:', error);
    }
    console.log(`[SERVER] Panel de control escuchando en http://localhost:${PORT}`);
});
