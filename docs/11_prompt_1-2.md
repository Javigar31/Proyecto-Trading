# Prompt 11: Optimización Cuantitativa V3.0 (Risk/Reward 1:2 y Filtro Anti-Rango)

Actúa como Arquitecto de Software experto en Trading Algorítmico. Necesitamos actualizar nuestro motor de simulación con las nuevas reglas cuantitativas que nos exigen un Risk/Reward neto de 1:2, endurecer los indicadores y añadir un filtro de volatilidad.

Por favor, modifica de forma autónoma el archivo `bot/simulator.js` implementando lo siguiente:

**1. Actualización de Gatillos SL y TP (`executeBuy` o funciones equivalentes de ejecución):**
Ajusta los multiplicadores matemáticos para fijar las metas de las órdenes basadas en el `precio_entrada`:
- Para posiciones LONG: TP = precio_entrada * 1.022043 | SL = precio_entrada * 0.991983
- Para posiciones SHORT: TP = precio_entrada * 0.978001 | SL = precio_entrada * 1.008001

**2. Reemplazo de la función Scoring (`calculateEntryProbability` o equivalente):**
Reemplaza la lógica actual con las siguientes reglas (Scoring V3):
- Añade el cálculo del Bollinger Band Width: `bbw = (bb.upper - bb.lower) / bb.middle`. Si `bbw < 0.015`, retorna { score: 0, type: 'NONE' }.
- Para LONG (Precio > EMA200): RSI inicializa en 45 y llega a max score (100%) en <= 25.
- Para SHORT (Precio <= EMA200): RSI inicializa en 55 y llega a max score (100%) en >= 75.
- La ponderación sigue siendo 60% RSI y 40% BB. Asegúrate de devolver el score y el type correspondiente.

**3. Umbral de Entrada más estricto:**
En la evaluación del Event Loop principal, cambia el umbral mínimo para abrir una posición del 85% al **90%**.

Aplica los cambios cuidando de mantener el correcto funcionamiento del Dual-Slot y la persistencia de datos. Avísame cuando la V3.0 esté lista.