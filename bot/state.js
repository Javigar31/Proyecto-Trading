/**
 * Estado global del bot. 
 * Se utiliza un singleton para que cualquier módulo pueda acceder y modificar
 * el estado en tiempo real sin perder sincronización.
 */

const state = {
    isBotRunning: false,
    virtualBalance: 100.0,
    // Aquí se agregarán más variables de estado como posiciones abiertas, precios, etc. en fases posteriores.
};

module.exports = state;
