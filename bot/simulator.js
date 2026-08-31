require('dotenv').config();
const ccxt = require('ccxt');
const { state, WHITELIST } = require('./state');
const indicators = require('./indicators');
const db = require('./db');
const PriceActionEngine = require('./PriceActionEngine');

/**
 * Calcula la probabilidad cuantitativa de entrada (0 a 100) y su dirección (LONG/SHORT).
 * LONG: Si precio > EMA200. RSI Score: 60->0%, 30->100%. BB Score: bbMid->0%, bbLower->100%.
 * SHORT: Si precio <= EMA200. RSI Score: 40->0%, 70->100%. BB Score: bbMid->0%, bbUpper->100%.
 */
function calculateEntryProbability(currentPrice, rsi, bbMid, bbLower, bbUpper, ema200, paData) {
    if (!currentPrice || !rsi || !bbMid || !bbLower || !bbUpper || !ema200) return { score: 0.0, type: null };

    // Filtro Anti-Rango (BBW) aumentado a 0.015 (Optimización v3.0)
    const bbw = (bbUpper - bbLower) / bbMid;
    if (bbw < 0.015) {
        return { score: 0.0, type: 'NONE' };
    }

    if (currentPrice > ema200) {
        // Sistema de Veto: Si hay patrón bajista en tendencia alcista, se bloquea la entrada.
        if (paData && paData.direction === -1) {
            return { score: 0.0, type: 'VETO_PA' };
        }

        const rsiScore = Math.max(0, Math.min(1, (45 - rsi) / (45 - 25)));
        const bbScore  = Math.max(0, Math.min(1, (bbMid - currentPrice) / (bbMid - bbLower)));
        let score = parseFloat(((rsiScore * 0.6 + bbScore * 0.4) * 100).toFixed(2));
        
        let paPattern = null;
        // El patrón es meramente informativo y solo se envía si acompaña y el score base ya es >= 90
        if (paData && paData.direction === 1 && score >= 90) {
            paPattern = paData.pattern;
        }
        
        score = Math.min(99.0, score);
        
        return {
            score: parseFloat(score.toFixed(2)),
            type: 'LONG',
            paPattern: paPattern
        };
    } else {
        // Sistema de Veto: Si hay patrón alcista en tendencia bajista, se bloquea la entrada.
        if (paData && paData.direction === 1) {
            return { score: 0.0, type: 'VETO_PA' };
        }

        const rsiScore = Math.max(0, Math.min(1, (rsi - 55) / (75 - 55)));
        const bbScore  = Math.max(0, Math.min(1, (currentPrice - bbMid) / (bbUpper - bbMid)));
        let score = parseFloat(((rsiScore * 0.6 + bbScore * 0.4) * 100).toFixed(2));
        
        let paPattern = null;
        if (paData && paData.direction === -1 && score >= 90) {
            paPattern = paData.pattern;
        }
        
        score = Math.min(99.0, score);
        
        return {
            score: parseFloat(score.toFixed(2)),
            type: 'SHORT',
            paPattern: paPattern
        };
    }
}

class Simulator {
    constructor() {
        this.exchange = new ccxt.binance();
        
        // Telemetría remota (Heartbeat) cada 5 minutos
        setInterval(() => {
            if (state.isBotRunning) {
                const slotsInUse = state.activePositions.filter(p => p !== null).length;
                db.updateHeartbeat(slotsInUse);
            }
        }, 5 * 60 * 1000);
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
            indicators.update1m(symbol, kline, kline.isClosed);
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
            const candles = indicators.getCandles(symbol);
            const paData = PriceActionEngine.analyzePatterns(candles);
            
            // Calcular probabilidad de entrada (para enviarla a UI)
            let { score: probability, type: signalType } = calculateEntryProbability(
                currentPrice, rsi, bollinger.middle, bollinger.lower, bollinger.upper, ema200, paData
            );

            // Bloqueo de entrada si está en cooldown
            if (state.cooldowns[symbol] && Date.now() < state.cooldowns[symbol]) {
                probability = 0.0;
                signalType = 'COOLDOWN';
            }

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
            // Verificar cooldown
            if (state.cooldowns[sym] && Date.now() < state.cooldowns[sym]) {
                return { symbol: sym, score: 0, type: null, paPattern: null };
            }

            const currentPrice = state.indicators[sym].currentPrice;
            const rsi = indicators.getRSI(sym);
            const bollinger = indicators.getBollinger(sym);
            const ema200 = indicators.getEMA200(sym);

            if (!currentPrice || !rsi || !bollinger || !ema200) {
                return { symbol: sym, score: 0, type: null, paPattern: null };
            }

            const candles = indicators.getCandles(sym);
            const paData = PriceActionEngine.analyzePatterns(candles);
            const entry = calculateEntryProbability(currentPrice, rsi, bollinger.middle, bollinger.lower, bollinger.upper, ema200, paData);
            
            return {
                symbol: sym,
                score: entry.score,
                type: entry.type,
                price: currentPrice,
                paPattern: entry.paPattern
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
                if (candidate.paPattern) {
                    state.emit('log', `[ACCIÓN DE PRECIO] Gatillo de francotirador activado por patrón: ${candidate.paPattern}`);
                }
                this.executeBuy(candidate.symbol, candidate.price, candidate.score, freeSlotIndex, candidate.type);
            } else {
                break; // No hay más slots libres
            }
        }
    }

    executeBuy(symbol, price, probability, slotIndex, type) {
        console.log(`[SIMULATOR] SEÑAL DE ${type === 'LONG' ? 'COMPRA' : 'VENTA CORTA'} EJECUTADA EN ${symbol} @ ${price} (SLOT ${slotIndex})`);
        
        // 1. Margen Asimétrico
        let allocatedMargin;
        if (state.virtualBalance > 100.0) {
            allocatedMargin = state.virtualBalance * 0.50; // 50%
        } else {
            allocatedMargin = 50.0;
        }
        
        // Blindaje contra balances insuficientes
        if (allocatedMargin > state.virtualBalance) {
            allocatedMargin = state.virtualBalance;
        }

        // 2. Apalancamiento y Nominal
        const nominalSize = allocatedMargin * state.LEVERAGE;
        const feeIn = nominalSize * state.FUTURE_FEE_RATE;
        const cryptoAmount = nominalSize / price;

        // 3. Cálculos Dinámicos de ROE (TP/SL)
        const L = state.LEVERAGE;
        const f = state.FUTURE_FEE_RATE;
        const P_entry = price;

        let targetTP, targetSL;
        if (type === 'LONG') {
            // ROE = (P_exit/P_entry - 1)*L - L*f - (P_exit/P_entry)*L*f
            targetTP = P_entry * ((state.TARGET_ROE_TP / L + 1 + f) / (1 - f));
            targetSL = P_entry * ((state.TARGET_ROE_SL / L + 1 + f) / (1 - f));
        } else {
            // SHORT: ROE = (1 - P_exit/P_entry)*L - L*f - (P_exit/P_entry)*L*f
            targetTP = P_entry * ((1 - f - state.TARGET_ROE_TP / L) / (1 + f));
            targetSL = P_entry * ((1 - f - state.TARGET_ROE_SL / L) / (1 + f));
        }

        state.activePositions[slotIndex] = {
            symbol: symbol,
            buyPrice: price,
            investedCrypto: cryptoAmount,
            targetTP: targetTP,
            targetSL: targetSL,
            slotIndex: slotIndex,
            allocatedMargin: allocatedMargin,
            feeIn: feeIn,
            nominalSize: nominalSize,
            type: type
        };
        
        state.emit('log', `[${type}] ${symbol} @ ${price} | Slot: ${slotIndex} | Margen: ${allocatedMargin.toFixed(2)} USDT | Nom: ${nominalSize.toFixed(2)} USDT`);
        
        const candleTime = Math.floor(Date.now() / 60000) * 60;
        state.emit('chart_data', { symbol, time: candleTime, price, signal: type === 'LONG' ? 'BUY' : 'SHORT_ENTRY', probability });
    }

    executeSell(symbol, price, reason, slotIndex) {
        console.log(`[SIMULATOR] ${reason} EJECUTADO EN ${symbol} @ ${price} (SLOT ${slotIndex})`);
        
        const pos = state.activePositions[slotIndex];
        
        let pnlBruto;
        if (pos.type === 'LONG') {
            pnlBruto = (price - pos.buyPrice) * pos.investedCrypto;
        } else {
            pnlBruto = (pos.buyPrice - price) * pos.investedCrypto;
        }
        
        const feeOut = (pos.investedCrypto * price) * state.FUTURE_FEE_RATE;
        const pnlNeto = pnlBruto - pos.feeIn - feeOut;

        state.virtualBalance += pnlNeto;

        // Sistema de Cooldown Anti-Ametrallamiento
        if (reason === 'STOP LOSS') {
            state.cooldowns[symbol] = Date.now() + (15 * 60 * 1000);
            state.emit('log', `[COOLDOWN] ${symbol} en enfriamiento por 15m tras SL.`);
        }

        // Persistencia asíncrona a la base de datos
        db.updateBalance(state.virtualBalance).catch(err => console.error('[DB] Error updateBalance:', err));
        db.saveTrade({
            symbol: symbol,
            buyPrice: pos.buyPrice,
            sellPrice: price,
            exitReason: reason,
            profitUsdt: pnlNeto
        }).catch(err => console.error('[DB] Error saveTrade:', err));

        state.emit('log', `[${reason}] ${symbol} @ ${price} | Slot: ${slotIndex} | Bruto: ${pnlBruto.toFixed(2)} | Fees: ${(pos.feeIn + feeOut).toFixed(2)} | Neto: ${pnlNeto.toFixed(2)} USDT`);
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
            profit: pnlNeto,
            balance: state.virtualBalance
        });

        // Liberar el slot
        state.activePositions[slotIndex] = null;
    }
}

module.exports = new Simulator();
