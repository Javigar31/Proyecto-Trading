# Prompt 9: Arquitectura Concurrente y Sistema Dual-Slot

Actúa como un Arquitecto de Software y Desarrollador Senior Node.js. Tu tarea es refactorizar el motor de simulación (`bot/simulator.js`) para pasar de un sistema secuencial (una operación a la vez) a un motor concurrente que pueda evaluar múltiples activos en paralelo utilizando un sistema de puntuación (Scoring).

Por favor, analiza y ejecuta de forma autónoma las siguientes modificaciones:

**1. Refactorización del Estado (Dual-Slot):**
- En la gestión del estado global del bot, elimina la variable de control única (`activePosition`).
- Implementa un modelo de capital "Dual-Slot": divide el balance disponible en dos espacios lógicos (Slots), cada uno con el 50% del capital virtual.
- El bot debe ser capaz de mantener un máximo de 2 posiciones abiertas simultáneamente, una en cada slot.

**2. Implementación de Evaluación Concurrente:**
- Modifica el ciclo principal de evaluación (`processTick` o la función equivalente que procesa el mercado) para que deje de evaluar los activos uno por uno.
- Implementa una función asíncrona que utilice `Promise.all` para calcular los indicadores (RSI, Bollinger, EMA200) de todos los símbolos de la `WHITELIST` en paralelo.

**3. Lógica de Scoring y Asignación:**
- En la función de cálculo de probabilidad, aplica la siguiente regla: Si el precio es menor o igual a la EMA 200, el score es 0. De lo contrario, calcula el score combinando el RSI (60% de peso, normalizado de 60 a 30) y las Bandas de Bollinger (40% de peso, normalizado de la banda media a la inferior).
- Una vez que `Promise.all` retorne los scores de todos los activos, filtra aquellos que tengan un score mayor o igual al 85% y que no tengan ya una posición abierta.
- Ordena los activos elegibles de mayor a menor score.
- Asigna los activos ganadores a los slots que estén libres y ejecuta la operación de compra simulada utilizando únicamente el capital de ese slot específico.

**4. Actualización en la Base de Datos (`db.js` y `simulator.js`):**
- Asegúrate de que, al cerrar una operación (Take Profit o Stop Loss), el profit se sume correctamente al balance general y al slot correspondiente.
- Llama a la base de datos de forma asíncrona (con `.catch()`) para guardar la operación en el historial y actualizar el balance total, tal como se implementó en la fase de persistencia.

Genera todo el código necesario y aplica las modificaciones en los archivos correspondientes. Avísame cuando la refactorización esté completada para realizar pruebas.