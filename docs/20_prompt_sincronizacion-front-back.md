# Prompt 20: Sincronización de Estado Frontend-Backend al Cargar

Actúa como Desarrollador Full-Stack. Al recargar la página (F5), el dashboard asume que el bot está detenido y muestra el botón verde "INICIAR BOT", incluso si el backend (`isBotRunning`) sigue operando. 

1. **En `server.js`:** Crea un endpoint rápido `GET /api/status` que retorne el estado actual del bot: `res.json({ isRunning: isBotRunning })`.
2. **En `public/app.js`:** Añade una función que se ejecute al cargar la página (`window.addEventListener('DOMContentLoaded', ...)`). Esta función debe hacer un `fetch` a `/api/status` y actualizar automáticamente el color, texto y estado lógico del botón principal (Rojo/Detener si es true, Verde/Iniciar si es false) para que coincida con la realidad del servidor.

Aplica los cambios silenciosamente.