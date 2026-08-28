# Prompt 19: Telemetría Remota en Neon Postgres (Heartbeat)

Actúa como DevOps y Senior Node.js. El bot corre localmente, pero necesito saber si está vivo cuando estoy fuera de casa monitoreando la base de datos en Neon.

1. **Modifica `bot/db.js`:** Añade una función `updateHeartbeat()` que haga un UPDATE en la tabla `bot_state` (id = 1) estableciendo un nuevo campo `last_ping = CURRENT_TIMESTAMP`. Si el campo no existe, altera la tabla en la inicialización para agregarlo.
2. **Inyecta el Latido en `bot/simulator.js`:** Crea un `setInterval` que llame a `db.updateHeartbeat()` cada 5 minutos exactos mientras el bot esté en estado de ejecución (`isBotRunning`).
3. **Registro de Operaciones Abiertas (Opcional):** Si es rápido de implementar, añade un log o actualiza un campo en `bot_state` que me indique cuántos "Slots" están en uso actualmente, para saber desde la oficina si hay un trade vivo.

Aplica los cambios y haz commit.