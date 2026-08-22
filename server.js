require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const state = require('./bot/state');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // TODO: Restringir a localhost en prod si aplica
app.use(express.json());

// Servir frontend estático
app.use(express.static(path.join(__dirname, 'public')));

// Endpoints de control
app.post('/api/start', (req, res) => {
    if (state.isBotRunning) {
        return res.status(400).json({
            status: 'error',
            message: 'El bot ya está en ejecución.',
            isBotRunning: state.isBotRunning
        });
    }

    state.isBotRunning = true;
    console.log('[API] Bot INICIADO por el usuario.');
    
    // TODO: Iniciar lógicas del bot (Fase 3)

    return res.json({
        status: 'success',
        message: 'Bot iniciado correctamente.',
        isBotRunning: state.isBotRunning
    });
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
    
    // TODO: Detener lógicas, cerrar websockets si aplica, etc.

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
