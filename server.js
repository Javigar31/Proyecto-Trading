require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const state = require('./bot/state');
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
    if (state.isBotRunning) {
        return res.status(400).json({
            status: 'error',
            message: 'El bot ya está en ejecución.',
            isBotRunning: state.isBotRunning
        });
    }

    try {
        // Fase de calentamiento (REST)
        await simulator.warmup();
        
        // Si el warmup es exitoso, marcamos como corriendo e iniciamos el stream
        state.isBotRunning = true;
        connectToBinance();
        console.log('[API] Bot INICIADO por el usuario.');

        return res.json({
            status: 'success',
            message: 'Bot iniciado correctamente.',
            isBotRunning: state.isBotRunning
        });
    } catch (error) {
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

// Inicio del servidor HTTP
app.listen(PORT, () => {
    console.log(`[SERVER] Panel de control escuchando en http://localhost:${PORT}`);
});
