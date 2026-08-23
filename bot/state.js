const EventEmitter = require('events');

const WHITELIST = ['SOL/USDT', 'DOGE/USDT', 'PEPE/USDT'];

class BotState extends EventEmitter {
    constructor() {
        super();
        this.isBotRunning = false;
        this.isWarmingUp = false;
        
        // Cuentas Paper Trading
        this.virtualBalance = 100.0;
        
        // Estado de posición (Solo se permite UNA a la vez en todo el sistema)
        // Estructura: { symbol, buyPrice, investedCrypto, targetTP, targetSL }
        this.activePosition = null; 
        
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
