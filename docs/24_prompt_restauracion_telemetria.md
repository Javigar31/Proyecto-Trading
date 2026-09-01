Actúa como Senior Node.js Developer. Tras implementar la Optimización Cuantitativa v3.0, el bot se queda en silencio absoluto después de `[WS] Conectado a Binance Streams`.

1. **Diagnóstico:** El filtro de volatilidad (`bbw < 0.015`) o el Sistema de Veto están haciendo un `return` temprano en `processTick` (o la función de evaluación en `bot/simulator.js`), bloqueando la ejecución del `console.log('[MERCADO]...')` y la emisión de datos SSE hacia el frontend.
2. **Solución:** Reestructura la función para que el cálculo de probabilidad asigne `score = 0.0` ante un veto o baja volatilidad, pero **NUNCA** bloquee la emisión de la telemetría.
3. El log de la terminal y el envío del payload al frontend (`chart_data`) deben ejecutarse obligatoriamente en cada ciclo de evaluación para mantener la UI hidratada e informar el estado del mercado, incluso si el score es 0.
4. Aplica los cambios silenciosamente sin romper el loop de WebSockets.