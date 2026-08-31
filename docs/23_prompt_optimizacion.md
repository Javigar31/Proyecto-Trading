Actúa como Quant Developer. Necesitamos aplicar la "Optimización Cuantitativa v3.0" para corregir la alta tasa de Stop Losses por entradas prematuras (machine-gunning).

Aplica autónomamente estas reglas en `bot/simulator.js` (o tu motor de evaluación):

1. **Bifurcación Direccional (EMA 200):** Si el precio actual > EMA 200, evalúa únicamente probabilidad de LONG. Si es <= EMA 200, evalúa únicamente SHORT.
2. **Scoring v3.0 (RSI + BB):** 
   - Para LONG: El score de RSI (60% peso) se maximiza cuando RSI <= 25.
   - Para SHORT: El score de RSI se maximiza cuando RSI >= 75.
3. **Filtro de Volatilidad (BBW):** Calcula el Bollinger Band Width: `bbw = (bb.upper - bb.lower) / bb.middle`. Si `bbw < 0.015`, retorna un score de 0 (ignorar activos sin volatilidad).
4. **Sistema de Veto (PriceActionEngine):** Elimina cualquier suma o resta matemática del modificador aditivo (+15 puntos) sobre la probabilidad base. Trata los patrones de acción del precio como un *Sistema de Veto*: la señal puede registrarse visualmente en los logs de forma informativa, pero no debe inflar la matemática del RSI y Bollinger.
5. **Umbral de Entrada:** Asegúrate de que el gatillo para abrir posición requiera un score final superior o igual al 90.0%.