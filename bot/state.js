const EventEmitter = require('events');

class BotState extends EventEmitter {
    constructor() {
        super();
        this.isBotRunning = false;
        
        // Cuentas Paper Trading
        this.virtualBalance = 100.0;
        
        // Estado de posición
        this.isPositionOpen = false;
        this.buyPrice = 0;
        this.investedCrypto = 0; // Cantidad de crypto poseída tras descontar la fee de compra
        
        // Indicadores (se almacenan aquí para ser consultados por logs)
        this.indicators = {
            rsi1m: null,
            bollingerLower1m: null,
            ema200_5m: null,
            currentPrice: null
        };
    }
}

// Singleton exportado
const state = new BotState();
module.exports = state;
