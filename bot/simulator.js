require('dotenv').config();
const ccxt = require('ccxt');
const { state, WHITELIST } = require('./state');
const indicators = require('./indicators');
const db = require('./db');

/**
 * Calcula la probabilidad cuantitativa de entrada (0 a 100).
 * RSI Score (60%): 60 -> 0%, 30 -> 100%. 
 * Bollinger Score (40%): bbMid -> 0%, bbLower -> 100%.
 * Hard Veto: Si precio <= EMA200, retorna 0 (tendencia bajista).
 */
function calculateEntryProbability(currentPrice, rsi, bbMid, bbLower, ema200) {
    if (!currentPrice || !rsi || !bbMid || !bbLower || !ema200) return 0.0;
    if (currentPrice <= ema200) return 0.0;

    const rsiScore = Math.max(0, Math.min(1, (60 - rsi) / (60 - 30)));
    const bbScore  = Math.max(0, Math.min(1, (bbMid - currentPrice) / (bbMid - bbLower)));

    return parseFloat(((rsiScore * 0.6 + bbScore * 0.4) * 100).toFixed(2));
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
            const probability = calculateEntryProbability(
                currentPrice, rsi, bollinger.middle, bollinger.lower, ema200
            );

            // Heartbeat de mercado y acciones al CERRAR la vela de 1m
            if (kline.interval === '1m' && kline.isClosed) {
                const decimals = symbol === 'PEPE/USDT' ? 8 : (symbol === 'DOGE/USDT' ? 4 : 2);
                state.emit('log', `> [MERCADO] ${symbol} | Precio: ${currentPrice.toFixed(decimals)} | RSI: ${rsi.toFixed(2)} | BB inf: ${bollinger.lower.toFixed(decimals)} | EMA200: ${ema200.toFixed(decimals)} | Prob: ${probability.toFixed(2)}%`);
                
                // Enviar a la gráfica para tiempo real
                const candleTime = Math.floor(Date.now() / 60000) * 60;
                state.emit('chart_data', { symbol, time: candleTime, price: currentPrice, signal: 'WAITING', probability });

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
                if (currentPrice >= pos.targetTP) {
                    this.executeSell(symbol, currentPrice, 'TAKE PROFIT', i);
                } else if (currentPrice <= pos.targetSL) {
                    this.executeSell(symbol, currentPrice, 'STOP LOSS', i);
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
                return { symbol: sym, score: 0 };
            }

            const score = calculateEntryProbability(currentPrice, rsi, bollinger.middle, bollinger.lower, ema200);
            
            return {
                symbol: sym,
                score: score,
                price: currentPrice
            };
        }));

        // Filtrar candidatos con score >= 85% y que NO estén ya abiertas en algún slot
        const elegibles = evaluations.filter(e => 
            e.score >= 85 && 
            !state.activePositions.some(p => p && p.symbol === e.symbol)
        );

        // Ordenar candidatos de mayor a menor score
        elegibles.sort((a, b) => b.score - a.score);

        // Asignar ganadores a slots libres
        for (const candidate of elegibles) {
            const freeSlotIndex = state.activePositions.findIndex(p => p === null);
            if (freeSlotIndex !== -1) {
                this.executeBuy(candidate.symbol, candidate.price, candidate.score, freeSlotIndex);
            } else {
                break; // No hay más slots libres
            }
        }
    }

    executeBuy(symbol, price, probability, slotIndex) {
        console.log(`[SIMULATOR] SEÑAL DE COMPRA EJECUTADA EN ${symbol} @ ${price} (SLOT ${slotIndex})`);
        
        // Inversión: 50% del balance virtual actual
        const investmentAmount = state.virtualBalance / 2.0;
        const fee = investmentAmount * 0.001; // 0.1% de fee de Binance
        const investedUSDT = investmentAmount - fee; 
        const cryptoAmount = investedUSDT / price;

        // Precalcular targets netos del Prompt 05 (+1.0% y -0.8% netos)
        const targetTP = price * 1.012023;
        const targetSL = price * 0.991983;

        state.activePositions[slotIndex] = {
            symbol: symbol,
            buyPrice: price,
            investedCrypto: cryptoAmount,
            targetTP: targetTP,
            targetSL: targetSL,
            slotIndex: slotIndex,
            originalInvestment: investmentAmount
        };
        
        state.emit('log', `[COMPRA] ${symbol} @ ${price} | Slot: ${slotIndex} | Inv: ${investedUSDT.toFixed(2)} USDT | Prob: ${probability.toFixed(2)}%`);
        
        const candleTime = Math.floor(Date.now() / 60000) * 60;
        state.emit('chart_data', { symbol, time: candleTime, price, signal: 'BUY', probability });
    }

    executeSell(symbol, price, reason, slotIndex) {
        console.log(`[SIMULATOR] ${reason} EJECUTADO EN ${symbol} @ ${price} (SLOT ${slotIndex})`);
        
        const pos = state.activePositions[slotIndex];
        const currentCryptoValue = pos.investedCrypto * price;
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
        state.emit('chart_data', { symbol, time: candleTime, price, signal, probability: 0 });

        // Liberar el slot
        state.activePositions[slotIndex] = null;
    }
}

module.exports = new Simulator();
