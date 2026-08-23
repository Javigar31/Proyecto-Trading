const { RSI, BollingerBands, EMA } = require('technicalindicators');

class IndicatorEngine {
    constructor() {
        // Buffers de precios de cierre (diccionarios por símbolo)
        this.closes1m = {};
        this.closes5m = {};
        
        // Tamaños máximos para no llenar la memoria
        this.maxBuffer1m = 50;
        this.maxBuffer5m = 250;
    }

    // Inicializar buffers desde ccxt (fase warmup)
    initBuffers(symbol, klines1m, klines5m) {
        this.closes1m[symbol] = klines1m.map(k => k[4]).slice(-this.maxBuffer1m);
        this.closes5m[symbol] = klines5m.map(k => k[4]).slice(-this.maxBuffer5m);
    }

    // Actualizar o añadir vela 1m
    update1m(symbol, closePrice, isClosed) {
        if (!this.closes1m[symbol]) this.closes1m[symbol] = [];
        const buffer = this.closes1m[symbol];

        if (isClosed) {
            buffer.push(closePrice);
            if (buffer.length > this.maxBuffer1m) buffer.shift();
        } else {
            // Vela en curso
            if (buffer.length === 0) buffer.push(closePrice);
            else buffer[buffer.length - 1] = closePrice;
        }
    }

    // Actualizar o añadir vela 5m
    update5m(symbol, closePrice, isClosed) {
        if (!this.closes5m[symbol]) this.closes5m[symbol] = [];
        const buffer = this.closes5m[symbol];

        if (isClosed) {
            buffer.push(closePrice);
            if (buffer.length > this.maxBuffer5m) buffer.shift();
        } else {
            if (buffer.length === 0) buffer.push(closePrice);
            else buffer[buffer.length - 1] = closePrice;
        }
    }

    // Calcular RSI 1m (14 periodos)
    getRSI(symbol) {
        const buffer = this.closes1m[symbol] || [];
        if (buffer.length < 15) return null;
        const result = RSI.calculate({ period: 14, values: buffer });
        return result[result.length - 1];
    }

    // Calcular Bollinger Bands 1m (20 periodos, mult 2)
    getBollinger(symbol) {
        const buffer = this.closes1m[symbol] || [];
        if (buffer.length < 20) return null;
        const result = BollingerBands.calculate({ period: 20, stdDev: 2, values: buffer });
        return result[result.length - 1];
    }

    // Calcular EMA 5m (200 periodos)
    getEMA200(symbol) {
        const buffer = this.closes5m[symbol] || [];
        if (buffer.length < 200) return null;
        const result = EMA.calculate({ period: 200, values: buffer });
        return result[result.length - 1];
    }
}

module.exports = new IndicatorEngine();
