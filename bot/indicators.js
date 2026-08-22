const { RSI, BollingerBands, EMA } = require('technicalindicators');

class IndicatorEngine {
    constructor() {
        // Buffers de precios de cierre
        this.closes1m = [];
        this.closes5m = [];
        
        // Tamaños máximos para no llenar la memoria
        this.maxBuffer1m = 50;
        this.maxBuffer5m = 250;
    }

    // Inicializar buffers desde ccxt (fase warmup)
    initBuffers(klines1m, klines5m) {
        this.closes1m = klines1m.map(k => k[4]).slice(-this.maxBuffer1m);
        this.closes5m = klines5m.map(k => k[4]).slice(-this.maxBuffer5m);
    }

    // Actualizar o añadir vela 1m
    update1m(closePrice, isClosed) {
        if (isClosed) {
            this.closes1m.push(closePrice);
            if (this.closes1m.length > this.maxBuffer1m) {
                this.closes1m.shift();
            }
        } else {
            // Vela en curso (reemplazar último valor temporalmente para cálculo realtime)
            this.closes1m[this.closes1m.length - 1] = closePrice;
        }
    }

    // Actualizar o añadir vela 5m
    update5m(closePrice, isClosed) {
        if (isClosed) {
            this.closes5m.push(closePrice);
            if (this.closes5m.length > this.maxBuffer5m) {
                this.closes5m.shift();
            }
        } else {
            this.closes5m[this.closes5m.length - 1] = closePrice;
        }
    }

    // Calcular RSI 1m (14 periodos)
    getRSI() {
        if (this.closes1m.length < 15) return null;
        const result = RSI.calculate({ period: 14, values: this.closes1m });
        return result[result.length - 1];
    }

    // Calcular Bollinger Bands 1m (20 periodos, mult 2)
    getBollinger() {
        if (this.closes1m.length < 20) return null;
        const result = BollingerBands.calculate({ period: 20, stdDev: 2, values: this.closes1m });
        return result[result.length - 1];
    }

    // Calcular EMA 5m (200 periodos)
    getEMA200() {
        if (this.closes5m.length < 200) return null;
        const result = EMA.calculate({ period: 200, values: this.closes5m });
        return result[result.length - 1];
    }
}

module.exports = new IndicatorEngine();
