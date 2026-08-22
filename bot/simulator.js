const ccxt = require('ccxt');
const state = require('./state');
const indicators = require('./indicators');

class Simulator {
    constructor() {
        this.symbol = 'BTC/USDT';
        this.exchange = new ccxt.binance();
    }

    async warmup() {
        console.log('[SIMULATOR] Iniciando fase de Warmup...');
        state.events.emit('log', '> Descargando historial de velas para indicadores...');
        
        try {
            // Descargar 50 velas de 1m y 250 velas de 5m en paralelo
            const [klines1m, klines5m] = await Promise.all([
                this.exchange.fetchOHLCV(this.symbol, '1m', undefined, 50),
                this.exchange.fetchOHLCV(this.symbol, '5m', undefined, 250)
            ]);
            
            indicators.initBuffers(klines1m, klines5m);
            console.log(`[SIMULATOR] Warmup completado. Velas 1m: ${klines1m.length}, Velas 5m: ${klines5m.length}`);
            state.events.emit('log', '> Warmup completado con éxito. Indicadores listos.');
        } catch (error) {
            console.error('[SIMULATOR] Error en warmup:', error);
            state.events.emit('log', `> ERROR en warmup: ${error.message}`);
            throw error; // Re-lanzar para manejar en server.js
        }
    }

    processTick(kline) {
        // kline format: { symbol, interval, close, isClosed }
        if (!state.isBotRunning) return;

        const currentPrice = parseFloat(kline.close);
        state.indicators.currentPrice = currentPrice;

        // Actualizar indicadores
        if (kline.interval === '1m') {
            indicators.update1m(currentPrice, kline.isClosed);
        } else if (kline.interval === '5m') {
            indicators.update5m(currentPrice, kline.isClosed);
        }

        // Obtener cálculos matemáticos
        const rsi = indicators.getRSI();
        const bollinger = indicators.getBollinger();
        const ema200 = indicators.getEMA200();

        // Actualizar el estado global para uso de la UI (Prompt 04)
        state.indicators.rsi1m = rsi;
        state.indicators.bollingerLower1m = bollinger ? bollinger.lower : null;
        state.indicators.ema200_5m = ema200;

        // Evaluar estrategia
        if (rsi && bollinger && ema200) {
            this.evaluateStrategy(currentPrice, rsi, bollinger.lower, ema200);
        }
    }

    evaluateStrategy(currentPrice, rsi, bollingerLower, ema200) {
        if (!state.isPositionOpen) {
            // --- GATILLO DE ENTRADA (Triple Confluencia) ---
            if (rsi < 30 && currentPrice <= bollingerLower && currentPrice > ema200) {
                this.executeBuy(currentPrice);
            }
        } else {
            // --- GATILLO DE SALIDA (Monitor de PNL en tiempo real) ---
            const currentCryptoValue = state.investedCrypto * currentPrice;
            const netReturn = currentCryptoValue * 0.999; // Descontar 0.1% de fee de salida

            if (netReturn >= 100.50) {
                this.executeSell(currentPrice, netReturn, 'TAKE PROFIT');
            } else if (netReturn <= 99.50) {
                this.executeSell(currentPrice, netReturn, 'STOP LOSS');
            }
        }
    }

    executeBuy(price) {
        console.log(`[SIMULATOR] SEÑAL DE COMPRA EJECUTADA @ ${price}`);
        
        // Simulación estricta de fees (0.1%)
        const investment = 100.0;
        const fee = investment * 0.001; // 0.1 USDT
        const investedUSDT = investment - fee; // 99.9 USDT reales a mercado
        const cryptoAmount = investedUSDT / price;

        state.isPositionOpen = true;
        state.buyPrice = price;
        state.investedCrypto = cryptoAmount;
        
        state.events.emit('log', `[COMPRA] Precio: ${price} | Fee: ${fee} USDT | Invertido neto: ${investedUSDT} USDT`);
    }

    executeSell(price, netReturn, reason) {
        console.log(`[SIMULATOR] ${reason} EJECUTADO @ ${price} | Retorno Neto: ${netReturn.toFixed(2)}`);
        
        // El capital virtual varía según el beneficio neto de los 100 USDT iniciales
        const profit = netReturn - 100.0; 
        state.virtualBalance += profit;

        state.events.emit('log', `[${reason}] Precio Venta: ${price} | Retorno Neto: ${netReturn.toFixed(2)} USDT | Profit: ${profit.toFixed(2)} USDT`);
        state.events.emit('log', `> Nuevo Balance Total: ${state.virtualBalance.toFixed(2)} USDT`);

        state.isPositionOpen = false;
        state.buyPrice = 0;
        state.investedCrypto = 0;
    }
}

module.exports = new Simulator();
