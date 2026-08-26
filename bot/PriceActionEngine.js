class PriceActionEngine {
    /**
     * Analiza las últimas velas y retorna un modificador de probabilidad si detecta patrones.
     * @param {Array} candles - Array de objetos { open, high, low, close, volume }
     * @returns {Object|null} { pattern: 'NOMBRE', direction: 1|-1, scoreModifier: Number }
     */
    static analyzePatterns(candles) {
        if (!candles || candles.length < 2) return null;

        const current = candles[candles.length - 1];
        const previous = candles[candles.length - 2];

        // Métricas vela actual
        const range = current.high - current.low;
        if (range === 0) return null; // Evitar división por cero

        const body = Math.abs(current.open - current.close);
        const upperWick = current.high - Math.max(current.open, current.close);
        const lowerWick = Math.min(current.open, current.close) - current.low;
        const filling = body / range;
        const ibs = (current.close - current.low) / range; // Internal Bar Strength

        // Métricas vela previa
        const prevRange = previous.high - previous.low;
        const prevBody = Math.abs(previous.open - previous.close);
        const isPrevBullish = previous.close > previous.open;
        const isPrevBearish = previous.close < previous.open;
        const isCurrentBullish = current.close > current.open;
        const isCurrentBearish = current.close < current.open;

        // 1. DOJI
        if (filling < 0.1 && upperWick > 0 && lowerWick > 0) {
            return { pattern: 'DOJI', direction: isCurrentBullish ? 1 : -1, scoreModifier: 5 };
        }

        // 2. BULLISH ENGULFING
        if (isPrevBearish && isCurrentBullish && current.close > previous.open && current.open < previous.close) {
            return { pattern: 'BULLISH_ENGULFING', direction: 1, scoreModifier: 15 };
        }

        // 3. BEARISH ENGULFING
        if (isPrevBullish && isCurrentBearish && current.close < previous.open && current.open > previous.close) {
            return { pattern: 'BEARISH_ENGULFING', direction: -1, scoreModifier: 15 };
        }

        // 4. BULLISH HARAMI
        if (isPrevBearish && isCurrentBullish && current.open > previous.close && current.close < previous.open) {
            return { pattern: 'BULLISH_HARAMI', direction: 1, scoreModifier: 8 };
        }

        // 5. BEARISH HARAMI
        if (isPrevBullish && isCurrentBearish && current.open < previous.close && current.close > previous.open) {
            return { pattern: 'BEARISH_HARAMI', direction: -1, scoreModifier: 8 };
        }

        // 6. HAMMER (Bullish pin bar)
        if (filling < 0.3 && lowerWick > (body * 2) && upperWick < body) {
            return { pattern: 'HAMMER', direction: 1, scoreModifier: 10 };
        }

        // 7. SHOOTING STAR (Bearish pin bar)
        if (filling < 0.3 && upperWick > (body * 2) && lowerWick < body) {
            return { pattern: 'SHOOTING_STAR', direction: -1, scoreModifier: 10 };
        }

        return null;
    }
}

module.exports = PriceActionEngine;
