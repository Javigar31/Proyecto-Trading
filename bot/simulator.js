require('dotenv').config();
const ccxt = require('ccxt');
const { state, WHITELIST } = require('./state');
const indicators = require('./indicators');
const db = require('./db');

/**
 * Calcula la probabilidad cuantitativa de entrada (0 a 100) y su dirección (LONG/SHORT).
 * LONG: Si precio > EMA200. RSI Score: 60->0%, 30->100%. BB Score: bbMid->0%, bbLower->100%.
 * SHORT: Si precio <= EMA200. RSI Score: 40->0%, 70->100%. BB Score: bbMid->0%, bbUpper->100%.
 */
function calculateEntryProbability(currentPrice, rsi, bbMid, bbLower, bbUpper, ema200) {
    if (!currentPrice || !rsi || !bbMid || !bbLower || !bbUpper || !ema200) return { score: 0.0, type: null };

    // Filtro Anti-Rango (BBW)
    const bbw = (bbUpper - bbLower) / bbMid;
    if (bbw < 0.015) {
        return { score: 0.0, type: 'NONE' };
    }

    if (currentPrice > ema200) {
        const rsiScore = Math.max(0, Math.min(1, (45 - rsi) / (45 - 25)));
        const bbScore  = Math.max(0, Math.min(1, (bbMid - currentPrice) / (bbMid - bbLower)));
        return {
            score: parseFloat(((rsiScore * 0.6 + bbScore * 0.4) * 100).toFixed(2)),
            type: 'LONG'
        };
    } else {
        const rsiScore = Math.max(0, Math.min(1, (rsi - 55) / (75 - 55)));
        const bbScore  = Math.max(0, Math.min(1, (currentPrice - bbMid) / (bbUpper - bbMid)));
        return {
            score: parseFloat(((rsiScore * 0.6 + bbScore * 0.4) * 100).toFixed(2)),
            type: 'SHORT'
        };
    }
}

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
        
        // Conectar BD y obtener estado base
        await db.initDB();
        state.virtualBalance = await db.getBalance();
        state.emit('log', `> [DB] Balance inicial cargado: ${state.virtualBalance.toFixed(2)} USDT`);

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

        // Si el estado de los indicadores no existe, ignorar
        if (!state.indicators[symbol]) return;

        state.indicators[symbol].currentPrice = currentPrice;

        // --- 1. EVALUAR SALIDAS EN TIEMPO REAL ---
        // Verificamos en cada tick (incluso si no cierra la vela) para SL/TP inmediato
        this.evaluateExit(symbol, currentPrice);

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

        // Validamos si todos los indicadores están listos
        if (rsi && bollinger && ema200) {
            // Calcular probabilidad de entrada (para enviarla a UI)
            const { score: probability, type: signalType } = calculateEntryProbability(
                currentPrice, rsi, bollinger.middle, bollinger.lower, bollinger.upper, ema200
            );

            // Enviar a la gráfica para tiempo real en CADA tick
            const candleTime = Math.floor(Date.now() / 60000) * 60;
            state.emit('chart_data', { symbol, time: candleTime, price: currentPrice, signal: 'WAITING', probability });

            // Heartbeat de mercado y acciones al CERRAR la vela de 1m
            if (kline.interval === '1m' && kline.isClosed) {
                const decimals = symbol === 'PEPE/USDT' ? 8 : (symbol === 'DOGE/USDT' ? 4 : 2);
                state.emit('log', `> [MERCADO] ${symbol} | Precio: ${currentPrice.toFixed(decimals)} | RSI: ${rsi.toFixed(2)} | BB inf: ${bollinger.lower.toFixed(decimals)} | EMA200: ${ema200.toFixed(decimals)} | Prob: ${probability.toFixed(2)}% (${signalType || 'N/A'})`);
                
                // --- 2. EVALUAR ENTRADAS DE FORMA CONCURRENTE AL CERRAR VELA ---
                this.evaluateMarketConcurrently().catch(err => console.error('[SIMULATOR] Error en evaluación concurrente:', err));
            }
        }
    }

    evaluateExit(symbol, currentPrice) {
        // Busca si el simbolo está en algún slot activo
        for (let i = 0; i < state.activePositions.length; i++) {
            const pos = state.activePositions[i];
            if (pos && pos.symbol === symbol) {
                if (pos.type === 'LONG') {
                    if (currentPrice >= pos.targetTP) {
                        this.executeSell(symbol, currentPrice, 'TAKE PROFIT', i);
                    } else if (currentPrice <= pos.targetSL) {
                        this.executeSell(symbol, currentPrice, 'STOP LOSS', i);
                    }
                } else if (pos.type === 'SHORT') {
                    if (currentPrice <= pos.targetTP) {
                        this.executeSell(symbol, currentPrice, 'TAKE PROFIT', i);
                    } else if (currentPrice >= pos.targetSL) {
                        this.executeSell(symbol, currentPrice, 'STOP LOSS', i);
                    }
                }
            }
        }
    }

    async evaluateMarketConcurrently() {
        // Promesas concurrentes para evaluar todos los símbolos
        const evaluations = await Promise.all(WHITELIST.map(async (sym) => {
            const currentPrice = state.indicators[sym].currentPrice;
            const rsi = indicators.getRSI(sym);
            const bollinger = indicators.getBollinger(sym);
            const ema200 = indicators.getEMA200(sym);

            if (!currentPrice || !rsi || !bollinger || !ema200) {
                return { symbol: sym, score: 0, type: null };
            }

            const entry = calculateEntryProbability(currentPrice, rsi, bollinger.middle, bollinger.lower, bollinger.upper, ema200);
            
            return {
                symbol: sym,
                score: entry.score,
                type: entry.type,
                price: currentPrice
            };
        }));

        // Filtrar candidatos con score >= 90% y que NO estén ya abiertas en algún slot
        const elegibles = evaluations.filter(e => 
            e.score >= 90 && 
            !state.activePositions.some(p => p && p.symbol === e.symbol)
        );

        // Ordenar candidatos de mayor a menor score
        elegibles.sort((a, b) => b.score - a.score);

        // Asignar ganadores a slots libres
        for (const candidate of elegibles) {
            const freeSlotIndex = state.activePositions.findIndex(p => p === null);
            if (freeSlotIndex !== -1) {
                this.executeBuy(candidate.symbol, candidate.price, candidate.score, freeSlotIndex, candidate.type);
            } else {
                break; // No hay más slots libres
            }
        }
    }

    executeBuy(symbol, price, probability, slotIndex, type) {
        console.log(`[SIMULATOR] SEÑAL DE ${type === 'LONG' ? 'COMPRA' : 'VENTA CORTA'} EJECUTADA EN ${symbol} @ ${price} (SLOT ${slotIndex})`);
        
        // Inversión: 50% del balance virtual actual
        const investmentAmount = state.virtualBalance / 2.0;
        const fee = investmentAmount * 0.001; // 0.1% de fee de Binance
        const investedUSDT = investmentAmount - fee; 
        const cryptoAmount = investedUSDT / price;

        let targetTP, targetSL;
        if (type === 'LONG') {
            targetTP = price * 1.022043;
            targetSL = price * 0.991983;
        } else {
            // SHORT: Risk/Reward 1:2 según parámetros V3
            targetTP = price * 0.978001; 
            targetSL = price * 1.008001; 
        }

        state.activePositions[slotIndex] = {
            symbol: symbol,
            buyPrice: price,
            investedCrypto: cryptoAmount,
            targetTP: targetTP,
            targetSL: targetSL,
            slotIndex: slotIndex,
            originalInvestment: investmentAmount,
            type: type
        };
        
        state.emit('log', `[${type}] ${symbol} @ ${price} | Slot: ${slotIndex} | Inv: ${investedUSDT.toFixed(2)} USDT | Prob: ${probability.toFixed(2)}%`);
        
        const candleTime = Math.floor(Date.now() / 60000) * 60;
        state.emit('chart_data', { symbol, time: candleTime, price, signal: type === 'LONG' ? 'BUY' : 'SHORT_ENTRY', probability });
    }

    executeSell(symbol, price, reason, slotIndex) {
        console.log(`[SIMULATOR] ${reason} EJECUTADO EN ${symbol} @ ${price} (SLOT ${slotIndex})`);
        
        const pos = state.activePositions[slotIndex];
        let currentCryptoValue;
        
        if (pos.type === 'LONG') {
            currentCryptoValue = pos.investedCrypto * price;
        } else {
            // SHORT: Recuperamos la inversión más/menos la diferencia de precio
            currentCryptoValue = (pos.originalInvestment - (pos.originalInvestment * 0.001)) + (pos.buyPrice - price) * pos.investedCrypto;
        }
        
        const netReturn = currentCryptoValue * 0.999; // Descontar 0.1% de fee de salida

        // El profit se calcula respecto al dinero real restado del balance al entrar
        const profit = netReturn - pos.originalInvestment; 
        state.virtualBalance += profit;

        // Persistencia asíncrona a la base de datos
        db.updateBalance(state.virtualBalance).catch(err => console.error('[DB] Error updateBalance:', err));
        db.saveTrade({
            symbol: symbol,
            buyPrice: pos.buyPrice,
            sellPrice: price,
            exitReason: reason,
            profitUsdt: profit
        }).catch(err => console.error('[DB] Error saveTrade:', err));

        state.emit('log', `[${reason}] ${symbol} @ ${price} | Slot: ${slotIndex} | Retorno: ${netReturn.toFixed(2)} USDT | Profit: ${profit.toFixed(2)} USDT`);
        state.emit('log', `> Nuevo Balance Total: ${state.virtualBalance.toFixed(2)} USDT`);
        
        const signal = reason === 'TAKE PROFIT' ? 'SELL_TP' : 'SELL_SL';
        const candleTime = Math.floor(Date.now() / 60000) * 60;
        state.emit('chart_data', { symbol, time: candleTime, price, signal, type: pos.type, probability: 0 });

        // Emitir evento para actualizar el historial
        state.emit('trade_closed', {
            symbol: symbol,
            type: pos.type,
            buyPrice: pos.buyPrice,
            sellPrice: price,
            reason: reason,
            profit: profit,
            balance: state.virtualBalance
        });

        // Liberar el slot
        state.activePositions[slotIndex] = null;
    }
}

module.exports = new Simulator();
