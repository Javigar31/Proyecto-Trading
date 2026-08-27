const EventEmitter = require('events');

const WHITELIST = ['SOL/USDT', 'DOGE/USDT', 'PEPE/USDT'];

class BotState extends EventEmitter {
    constructor() {
        super();
        this.isBotRunning = false;
        this.isWarmingUp = false;
        
        // Cuentas Paper Trading
        this.virtualBalance = 100.0;
        
        // Configuración de Riesgo y Apalancamiento (Futures V3.0)
        this.LEVERAGE = 10;
        this.FUTURE_FEE_RATE = 0.001; // 0.1% taker fee
        this.TARGET_ROE_TP = 0.20;    // +20% ROE neto
        this.TARGET_ROE_SL = -0.10;   // -10% ROE neto
        
        // Estado de posiciones Dual-Slot (Máximo 2 posiciones a la vez)
        // Estructura de cada slot: { symbol, buyPrice, investedCrypto, targetTP, targetSL, slotIndex, allocatedMargin, feeIn, nominalSize, type }
        this.activePositions = [null, null]; 
        
        // Cooldowns anti-ametrallamiento (diccionario por símbolo)
        this.cooldowns = {};
        
        // Indicadores (diccionario por símbolo)
        this.indicators = {};
        WHITELIST.forEach(symbol => {
            this.indicators[symbol] = {
                rsi1m: null,
                bollingerLower1m: null,
                ema200_5m: null,
                currentPrice: null
            };
        });
    }
}

// Singleton exportado
const state = new BotState();
module.exports = { state, WHITELIST };
