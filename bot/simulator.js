const ccxt = require('ccxt');
const { state, WHITELIST } = require('./state');
const indicators = require('./indicators');

class Simulator {
    constructor() {
        this.exchange = new ccxt.binance();
    }

    async warmupSymbol(symbol) {
        try {
            const [klines1m, klines5m] = await Promise.all([
                this.exchange.fetchOHLCV(symbol, '1m', undefined, 50),
                this.exchange.fetchOHLCV(symbol, '5m', undefined, 250)
            ]);
            
            indicators.initBuffers(symbol, klines1m, klines5m);
            console.log(`[SIMULATOR] Warmup completado para ${symbol}. Velas 1m: ${klines1m.length}, Velas 5m: ${klines5m.length}`);
            state.emit('log', `> Warmup OK: ${symbol}`);
        } catch (error) {
            console.error(`[SIMULATOR] Error en warmup de ${symbol}:`, error);
            state.emit('log', `> ERROR warmup ${symbol}: ${error.message}`);
            throw error;
        }
    }

    async warmup() {
        console.log('[SIMULATOR] Iniciando fase de Warmup...');
        state.emit('log', '> Descargando historial de velas para indicadores...');
        
        await Promise.allSettled(
            WHITELIST.map(symbol => this.warmupSymbol(symbol))
        );
        
        state.emit('log', '> Warmup completado. Indicadores listos.');
    }

    processTick(kline) {
        // kline format: { symbol, interval, close, isClosed }
        if (!state.isBotRunning) return;

        const currentPrice = parseFloat(kline.close);
        const symbol = kline.symbol;

        // Si el estado de los indicadores no existe (ej. un fallo de warmup extremo), ignorar
        if (!state.indicators[symbol]) return;

        state.indicators[symbol].currentPrice = currentPrice;

        // Actualizar indicadores
        if (kline.interval === '1m') {
            indicators.update1m(symbol, currentPrice, kline.isClosed);
        } else if (kline.interval === '5m') {
            indicators.update5m(symbol, currentPrice, kline.isClosed);
        }

        // Obtener cálculos matemáticos
        const rsi = indicators.getRSI(symbol);
        const bollinger = indicators.getBollinger(symbol);
        const ema200 = indicators.getEMA200(symbol);

        // Actualizar el estado global para uso de la UI
        state.indicators[symbol].rsi1m = rsi;
        state.indicators[symbol].bollingerLower1m = bollinger ? bollinger.lower : null;
        state.indicators[symbol].ema200_5m = ema200;

        // Evaluar estrategia
        if (rsi && bollinger && ema200) {
            // Heartbeat de mercado (Logs solo al cerrar)
            if (kline.interval === '1m' && kline.isClosed) {
                const decimals = symbol === 'PEPE/USDT' ? 8 : (symbol === 'DOGE/USDT' ? 4 : 2);
                state.emit('log', `> [MERCADO] ${symbol} | Precio: ${currentPrice.toFixed(decimals)} | RSI: ${rsi.toFixed(2)} | BB inf: ${bollinger.lower.toFixed(decimals)} | EMA200: ${ema200.toFixed(decimals)}`);
            }
            
            // Enviar a la gráfica en cada tick para tiempo real
            if (kline.interval === '1m') {
                const candleTime = Math.floor(Date.now() / 60000) * 60;
                // Adjuntamos el symbol al evento chart_data
                state.emit('chart_data', { symbol: symbol, time: candleTime, price: currentPrice, signal: 'WAITING' });
            }

            this.evaluateStrategy(symbol, currentPrice, rsi, bollinger.lower, ema200);
        }
    }

    evaluateStrategy(symbol, currentPrice, rsi, bollingerLower, ema200) {
        if (!state.activePosition) {
            // --- GATILLO DE ENTRADA (Triple Confluencia) ---
            if (rsi < 30 && currentPrice <= bollingerLower && currentPrice > ema200) {
                this.executeBuy(symbol, currentPrice);
            }
        } else {
            // --- GATILLO DE SALIDA ---
            // IMPORTANTE: Solo evaluamos si el tick corresponde al activo que tenemos comprado
            if (state.activePosition.symbol !== symbol) return;

            // Comparar con el TP/SL precalculado
            if (currentPrice >= state.activePosition.targetTP) {
                this.executeSell(symbol, currentPrice, 'TAKE PROFIT');
            } else if (currentPrice <= state.activePosition.targetSL) {
                this.executeSell(symbol, currentPrice, 'STOP LOSS');
            }
        }
    }

    executeBuy(symbol, price) {
        console.log(`[SIMULATOR] SEÑAL DE COMPRA EJECUTADA EN ${symbol} @ ${price}`);
        
        // Simulación estricta de fees (0.1%)
        const investment = 100.0;
        const fee = investment * 0.001; // 0.1 USDT
        const investedUSDT = investment - fee; // 99.9 USDT reales a mercado
        const cryptoAmount = investedUSDT / price;

        // Precalcular targets netos del Prompt 05 (+1.0% y -0.8% netos después de todas las comisiones)
        const targetTP = price * 1.012023;
        const targetSL = price * 0.991983;

        state.activePosition = {
            symbol: symbol,
            buyPrice: price,
            investedCrypto: cryptoAmount,
            targetTP: targetTP,
            targetSL: targetSL
        };
        
        state.emit('log', `[COMPRA] ${symbol} @ ${price} | Fee: ${fee} USDT | Invertido neto: ${investedUSDT} USDT`);
        
        const candleTime = Math.floor(Date.now() / 60000) * 60;
        state.emit('chart_data', { symbol: symbol, time: candleTime, price: price, signal: 'BUY' });
    }

    executeSell(symbol, price, reason) {
        console.log(`[SIMULATOR] ${reason} EJECUTADO EN ${symbol} @ ${price}`);
        
        const currentCryptoValue = state.activePosition.investedCrypto * price;
        const netReturn = currentCryptoValue * 0.999; // Descontar 0.1% de fee de salida

        const profit = netReturn - 100.0; 
        state.virtualBalance += profit;

        state.emit('log', `[${reason}] ${symbol} @ ${price} | Retorno Neto: ${netReturn.toFixed(2)} USDT | Profit: ${profit.toFixed(2)} USDT`);
        state.emit('log', `> Nuevo Balance Total: ${state.virtualBalance.toFixed(2)} USDT`);
        
        const signal = reason === 'TAKE PROFIT' ? 'SELL_TP' : 'SELL_SL';
        const candleTime = Math.floor(Date.now() / 60000) * 60;
        state.emit('chart_data', { symbol: symbol, time: candleTime, price: price, signal: signal });

        state.activePosition = null;
    }
}

module.exports = new Simulator();
