# Prompt 10: Transición a Binance Futures (Soporte Long/Short Dual-Slot) y Actualización de UI

Actúa como Arquitecto de Software y desarrollador Full-Stack experto en Node.js. Tu misión es refactorizar el simulador para soportar posiciones bidireccionales (Long y Short) basándote en la arquitectura "Asset Isolation", y actualizar la interfaz gráfica para reflejar el historial y los balances en tiempo real.

Por favor, modifica los archivos necesarios (`state.js`, `simulator.js`, `public/index.html` y `public/app.js`) implementando lo siguiente de forma autónoma:

**1. Adaptación del Estado (`state.js`):**
- Modifica la estructura de los slots en `activePositions` para que cada posición abierta guarde no solo el símbolo y el precio, sino también el **tipo de operación** (ej: `type: 'LONG'` o `type: 'SHORT'`).

**2. Refactorización del Scoring Matemático (`simulator.js`):**
- Modifica la función de cálculo de probabilidad de entrada para que devuelva tanto el score como el tipo de señal (`{ score: Number, type: 'LONG' | 'SHORT' }`).
- Implementa la lógica de bifurcación de la EMA200 (5m):
  - Si Precio > EMA200: Calcula score de LONG (RSI < 30, Bollinger Lower).
  - Si Precio <= EMA200: Calcula score de SHORT (RSI > 70, Bollinger Upper).

**3. Ejecución y Cierre Bidireccional (`simulator.js`):**
- Refactoriza el proceso de simulación milisegundo a milisegundo para que evalúe los gatillos dependiendo del `type` de la posición abierta.
- **Para LONG:** TP en +1.0% neto (precio sube), SL en -0.8% neto (precio baja).
- **Para SHORT:** TP en +1.0% neto (precio baja ~1.20%), SL en -0.8% neto (precio sube ~0.60%). 
  (Aplica las fórmulas matemáticas de retornos netos descontando el 0.1% de comisión In/Out).
- Al cerrar cualquier posición, asegúrate de actualizar el balance global, hacer la persistencia en DB (`saveTrade`), y emitir un evento SSE específico (ej. `TRADE_CLOSED`) que incluya el nuevo balance y los detalles de la operación.

**4. Aislamiento Estricto (Asset Isolation):**
- Si un activo ya tiene un slot ocupado, el bot debe IGNORAR cualquier nueva señal de ese mismo activo, buscando diversificar el capital libre en los demás activos de la WHITELIST.

**5. Actualización en Tiempo Real de la Interfaz (Frontend):**
- En `public/index.html`, modifica el layout ("Bento Grid"). Al lado o integrado con el contenedor de la "Terminal de Logs", añade un nuevo panel o sección llamado "Historial de Operaciones".
- En `public/app.js`, escucha el nuevo evento SSE de operación cerrada (`TRADE_CLOSED`).
- Cuando se reciba el evento:
  1. Actualiza INMEDIATAMENTE el elemento del DOM que muestra el Balance Actual.
  2. Crea y añade una nueva fila/tarjeta al "Historial de Operaciones" detallando: Símbolo, Tipo (Long/Short), Precio Entrada, Precio Salida, Razón (TP/SL) y Profit (en verde si es positivo, rojo si es negativo).

Procede con todos los cambios y avísame cuando el sistema esté listo.