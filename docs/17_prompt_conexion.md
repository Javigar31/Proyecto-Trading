# Prompt 17: Estabilidad de Conexión, Keep-Alive y Reconexión Silenciosa

Actúa como Ingeniero DevOps y Senior Node.js. El usuario reporta desconexiones súbitas en el dashboard que simulan una recarga de la página o una pérdida total de datos tras un tiempo de ejecución. Esto indica problemas de Timeout en el SSE o caídas no controladas del WebSocket de Binance.

Por favor, revisa e implementa de forma autónoma las siguientes soluciones de estabilidad:

**1. SSE Keep-Alive (Heartbeat) en el Backend (server.js o routes):**
- En el endpoint que expone el Server-Sent Events (`/api/logs` o similar), implementa un `setInterval` que envíe un "latido" vacío o un comentario (ej. `res.write(':\n\n');` o un evento de tipo `ping`) cada 30 segundos. Esto evitará que el navegador cierre la conexión por timeout de inactividad.
- Asegúrate de limpiar (clear) este intervalo si el cliente cierra la conexión (`req.on('close', ...)`).

**2. Auto-Reconexión Resiliente del WebSocket (websocket.js):**
- Revisa la conexión `ws` hacia Binance. Si se dispara el evento `ws.on('error')` o `ws.on('close')`, el bot **no debe hacer crash**. 
- Atrapa los errores silenciosamente y programa un `setTimeout` de 5 segundos para volver a instanciar la conexión a Binance automáticamente. Emite un log al frontend diciendo `[SISTEMA] Reconectando a Binance WebSockets...`.

**3. Auditoría Estricta del Frontend (app.js):**
- Revisa el listener del `EventSource` (SSE). En el evento `onerror`, asegúrate estrictamente de que NO haya ningún `window.location.reload()`. 
- Si el SSE se desconecta, la UI debe mantenerse intacta, y el `EventSource` nativo intentará reconectar solo. Puedes añadir un pequeño badge visual o cambiar el texto de estado a "Reconectando panel..." sin recargar el DOM.

Aplica estos parches de estabilidad de inmediato y confírmame los cambios realizados.