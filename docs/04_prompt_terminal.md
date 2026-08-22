Configura la transmisión de logs en tiempo real para no depender de la terminal de Node. 

1. En server.js, crea un endpoint /api/logs utilizando Server-Sent Events (SSE). Emite un evento SSE al cliente para cada acción clave: actualizaciones de indicadores, señales de compra, cálculos de comisión, PNL en tiempo real y ventas.
2. En el frontend, crea un contenedor de "Terminal Holográfica" (fondo negro, texto monoespaciado verde, scroll automático). 
3. Conecta el frontend al SSE e imprime línea por línea cada evento, utilizando colores (rojo para Stop Loss, verde para Take Profit, blanco/gris para información general o actualizaciones de indicadores).