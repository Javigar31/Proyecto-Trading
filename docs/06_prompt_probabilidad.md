# Prompt 6: Integración del Medidor de Probabilidad Cuantitativa

Actúa como un Desarrollador Senior Full-Stack. Tu tarea es analizar mi código actual y modificar autónomamente los archivos necesarios para implementar un 'Medidor de Probabilidad de Entrada' en el dashboard de mi bot de scalping.

**La Lógica Matemática (Reglas Cuantitativas):**
Debes crear una función `calculateEntryProbability(currentPrice, rsi, bbMid, bbLower, ema200_5m)` con las siguientes reglas estandarizadas:
1. Si alguno de los parámetros es nulo/indefinido, retorna 0.0.
2. Hard Veto: Si `currentPrice <= ema200_5m`, retorna 0.0 (invalida por tendencia).
3. RSI Score (60% de peso): Mapea linealmente el RSI donde 60 es 0% y 30 es 100%. Usa `Math.max(0, Math.min(1, valor))` para limitar (clamp) entre 0 y 1.
4. Bollinger Score (40% de peso): Mapea linealmente donde `bbMid` es 0% y `bbLower` es 100%. Limita entre 0 y 1.
5. Retorna la probabilidad total (0 a 100) redondeada a dos decimales.

**Modificaciones que debes ejecutar en los archivos:**

**1. `bot/simulator.js`:**
- Implementa la función matemática en este archivo.
- Dentro de `processTick()`, antes de ejecutar `evaluateStrategy`, calcula la probabilidad llamando a la función (usa `bollinger.middle` y `bollinger.lower`).
- Añade esta probabilidad calculada al final del string del log de mercado (heartbeat).
- Inyecta la propiedad `probability` en el objeto que se emite a través de `state.emit('chart_data', ...)` para todos los ticks y señales (BUY, SELL_TP, SELL_SL).

**2. `public/index.html`:**
- En la sección `<div class="stats-grid">`, añade una tercera tarjeta (`stat-card`) que ocupe 2 columnas (`grid-column: span 2`).
- Esta tarjeta debe tener un título "Probabilidad de Entrada", un texto para el porcentaje (`id="prob-text"`) y un contenedor de barra de progreso (`id="prob-bar"`).

**3. `public/styles.css`:**
- Crea los estilos Glassmorphism para `.progress-container` y `.progress-bar`.
- Añade una clase modificadora `.progress-bar.hot` que cambie el color a verde brillante neón.

**4. `public/app.js`:**
- En la función que recibe el SSE (`initTerminal`), captura el `data.chart.probability`.
- Usa ese valor para actualizar el `width` de la barra de progreso y el `textContent` del texto.
- Añade una lógica que asigne la clase `.hot` y ponga el texto en verde si la probabilidad es >= 80%.
- En el event listener del `chart-symbol-select`, asegúrate de resetear la barra de progreso a 0% cuando el usuario cambie de pestaña.

Por favor, lee los archivos, realiza todas estas implementaciones de forma autónoma utilizando tus herramientas de edición y avísame cuando el sistema esté listo para ser probado.