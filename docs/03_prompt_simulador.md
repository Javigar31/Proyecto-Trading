Añade el motor de simulación matemática (Paper Trading) a server.js. 

1. Define un saldo inicial virtualBalance = 100.0. 
2. Configura una conexión a WebSockets combinados de Binance (`wss://stream.binance.com:9443/stream?streams=btcusdt@kline_1m/btcusdt@kline_5m`). 
3. Almacena los históricos de precios de cierre (50 velas para 1m y 250 velas para 5m). 
4. Usa la librería technicalindicators para calcular en tiempo real: RSI(14) en 1m, Bollinger Bands(20, 2) en 1m, y EMA(200) en 5m.
5. Lógica de Entrada: Si isBotRunning es true y no hay posición, simula compra (descontando 0.1% de comisión) SOLO si RSI < 30, Precio <= Banda Bollinger Inferior, y Precio > EMA 200.
6. Lógica de Salida: Evalúa el retorno neto descontando el 0.1% de comisión de venta. Ejecuta Take Profit si el retorno es >= 100.50 USDT. Ejecuta Stop Loss si el retorno es <= 99.50 USDT.