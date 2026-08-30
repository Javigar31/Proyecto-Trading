# Prompt 21: Hidratación Histórica de la Gráfica al Cambiar de Activo

Actúa como Desarrollador Full-Stack. Actualmente, al cambiar de moneda en el `<select>` del frontend, la gráfica se borra y empieza desde cero, esperando los nuevos eventos SSE. Necesitamos que recupere el historial inmediato almacenado en memoria.

1. **Backend (`server.js`):** Crea un endpoint `GET /api/chart-history?symbol=XXX`. Este endpoint debe acceder a la instancia global de los indicadores y retornar el array de los últimos precios de cierre en 1 minuto para la moneda solicitada.
2. **Frontend (`public/app.js`):** En el `eventListener` del cambio de moneda (`change`), justo después de limpiar la instancia de la gráfica, realiza un `fetch` a `/api/chart-history?symbol=XXX`. 
3. **Renderizado:** Itera sobre el array de precios devuelto y usa tu lógica de renderizado existente para pre-poblar la gráfica con ese historial inmediatamente, integrándose limpiamente con los futuros eventos SSE.

Aplica los cambios silenciosamente sin romper el proceso principal.