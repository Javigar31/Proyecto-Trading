# Prompt de Refactorización: Motor Multi-Activo (Altcoins)

**Rol:** Actúa como un Desarrollador Senior de Node.js experto en Trading Algorítmico. 
**Objetivo:** Refactorizar el motor de simulación actual (BTC/USDT) para convertirlo en un sistema multi-activo de alta volatilidad operando `SOL/USDT`, `DOGE/USDT` y `PEPE/USDT`, aplicando nuevas reglas de gestión de riesgo financiero.

Por favor, actualiza los siguientes archivos con estas reglas estrictas:

### 1. `bot/state.js`
- Añade la constante `WHITELIST = ['SOL/USDT', 'DOGE/USDT', 'PEPE/USDT']`.
- Reemplaza `buyPrice` e `investedCrypto` por un objeto `activePosition = null`.
- El objeto `indicators` ahora debe ser un diccionario anidado por símbolo, para guardar el estado de cada moneda por separado.

### 2. `bot/indicators.js`
- Refactoriza la clase para que `closes1m` y `closes5m` sean diccionarios (objetos) donde la llave sea el símbolo (ej. `this.closes1m['SOL/USDT'] = []`).
- Actualiza los métodos `initBuffers`, `update1m`, `update5m`, `getRSI`, `getBollinger` y `getEMA200` para que obligatoriamente reciban el `symbol` como parámetro.

### 3. `bot/websocket.js`
- Modifica la conexión para suscribirse a los streams combinados de los 3 activos al tiempo (`solusdt@kline_1m`, `solusdt@kline_5m`, `dogeusdt@kline_1m`, etc.).
- Al recibir un mensaje, extrae el símbolo original de `klineData.s` (ej. convertir `SOLUSDT` a `SOL/USDT`) y envíalo a `simulator.processTick(kline)`.

### 4. `bot/simulator.js`
- **`warmup()`:** Modifícalo para que haga un `Promise.all` e itere sobre la `WHITELIST`, usando `ccxt` para descargar el historial REST (50 velas de 1m y 250 de 5m) para CADA UNA de las monedas antes de arrancar.
- **`processTick()`:** Pasa el `symbol` a los indicadores. Mantén el 'latido' SSE por cada moneda, pero asegúrate de que el bot siga mandando los eventos `chart_data` (con `time`, `price`, `signal`) al frontend.
- **Matemática Financiera (`executeBuy` / `executeSell`):** 
  - El bot solo puede tener **UNA** posición abierta a la vez en todo el sistema. Si ya compró SOL, ignorará las señales de DOGE o PEPE hasta que venda SOL.
  - Aplica los nuevos umbrales de Take Profit y Stop Loss del +1.0% neto para calcular los objetivos al momento de la compra: 
    - `targetTP = price * 1.012023`
    - `targetSL = price * 0.991983`
  - En la evaluación del tick, si hay una posición activa y el precio actual de **ESA** moneda alcanza el TP o SL, ejecuta la venta, actualiza el `virtualBalance` (simulando comisión 0.1% in/out) y libera la posición (`activePosition = null`).

**Entregable:** Devuélveme el código completo y estructurado de los 4 archivos refactorizados.