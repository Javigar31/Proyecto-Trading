# Documento Maestro de Arquitectura y Reglas de Negocio: Bot de Scalping Algorítmico

## 1. Visión General y Objetivo del Proyecto
El objetivo es construir, probar y desplegar un bot de trading algorítmico de alta frecuencia (Scalping) que operará de forma automatizada en el mercado de criptomonedas. 
*   **Mercado objetivo:** Binance Spot (Mercado al contado puro, sin margen ni apalancamiento).
*   **Capital de trabajo:** 100 USDT por cada operación.
*   **Interfaz:** Un panel de control (Dashboard web local) que permita arrancar, detener y monitorear las operaciones del bot en tiempo real sin necesidad de interactuar con la consola de comandos del servidor.

## 2. Stack Tecnológico Estricto
La aplicación se dividirá en dos capas claramente definidas:

*   **Backend (Lógica y Conexión):** 
    *   Entorno: `Node.js` nativo.
    *   Servidor web local: `Express.js` (para servir la interfaz y exponer endpoints de control).
    *   Conexión Exchange: `ccxt` para interacciones REST (futuras compras/ventas reales) y WebSockets nativos (`ws`) conectándose a los streams de Binance (`wss://stream.binance.com:9443`) para lectura de precios y velas en tiempo real con latencia cero.
    *   Indicadores: Librería `technicalindicators` (o similar) para el cálculo preciso del RSI.
*   **Frontend (Interfaz de Usuario):** 
    *   `HTML5`, `CSS3` y `Vanilla JavaScript` (sin frameworks pesados como React o Angular para mantener la ligereza).
    *   Comunicación en tiempo real: `Server-Sent Events (SSE)` para transmitir los logs del backend al frontend sin sobrecargar el navegador con polling continuo.

## 3. Lógica Matemática y Reglas Operativas (Modo Paper Trading)
El bot debe incorporar un motor de simulación interno (`SIMULATION_MODE = true`) para realizar pruebas sin arriesgar capital real. Las reglas matemáticas son estrictas y no negociables:

*   **Capital Inicial de Simulación:** 100 USDT.
*   **Gestión de Comisiones (Fees):** El motor debe simular la comisión estándar de Binance Spot del **0.1% por cada transacción** (0.1% al comprar y 0.1% al vender).
    *   *Ejemplo estricto:* Al simular la compra con 100 USDT, se descuenta inmediatamente 0.1 USDT. El capital real invertido en la moneda es de 99.9 USDT.
*   **Gatillo de Entrada (Señal de Compra):** 
    1. El bot debe escuchar el WebSocket de Binance para el flujo de velas de 1 minuto (`kline_1m`) del par `BTC/USDT`.
    2. En cada cierre de vela (o en tiempo real), debe calcular el indicador RSI (Relative Strength Index) utilizando una longitud de **14 periodos**.
    3. La orden de compra simulada se ejecutará **ÚNICA Y EXCLUSIVAMENTE** cuando el valor del RSI cruce a la baja el nivel de **30** (zona de sobreventa técnica). El bot no debe comprar inmediatamente al iniciar el script bajo ninguna circunstancia.
*   **Gatillos de Salida (Toma de Ganancias y Stop Loss):**
    Una vez posicionados en el mercado, el bot evaluará cada tick de precio mediante WebSocket:
    *   **Take Profit (Ganancia Neta +0.5%):** El bot debe calcular el valor de venta requerido para que, *después* de descontar el 0.1% de comisión de salida, el saldo final sea exactamente un 0.5% mayor al saldo inicial de 100 USDT (es decir, cerrar la operación cuando el retorno a la billetera sea de $\ge$ 100.50 USDT).
    *   **Stop Loss (Pérdida Máxima -0.5%):** Si el precio del activo cae hasta que el valor de la posición (menos la futura comisión de salida) represente una pérdida del 0.5% respecto al capital inicial (saldo de retorno $\le$ 99.50 USDT), el bot ejecutará una venta de emergencia para proteger el capital.
*   **Reinicio de Ciclo:** Al cerrar una posición (sea por Take Profit o Stop Loss), el bot registrará el nuevo saldo acumulado en el log y volverá al estado de "Escucha", esperando a que el RSI caiga de nuevo por debajo de 30 para abrir una nueva operación.

## 4. Plan de Acción y Fases de Despliegue

*   **Fase 1: Análisis y Arquitectura:** (Fase completada mediante la creación de este documento de especificaciones técnicas).
*   **Fase 2: Desarrollo e Integración:** Creación de los módulos backend, frontend, endpoints de comunicación, y configuración de los streams de WebSocket.
*   **Fase 3: Pruebas (Paper Trading):** Ejecución del bot en simulación durante un mínimo de 7 días. El objetivo es registrar el PNL (Profit and Loss), validar que las comisiones se calculan correctamente y comprobar la efectividad estadística del RSI en el nivel 30 para velas de 1 minuto.
*   **Fase 4: Paso a Producción:** 
    1. Creación de API Keys en Binance con restricción de IP y habilitadas SOLO para "Spot Trading" (sin permisos de retiro/Withdrawal).
    2. Transición del código de peticiones simuladas a ejecución real mediante la librería `ccxt`.
    3. Monitoreo intensivo de latencia y *slippage* (diferencia entre el precio esperado y el ejecutado) durante las primeras 48 horas.

---

## 5. Prompts de Construcción Secuencial
(Entregar estas instrucciones al LLM una a la vez para garantizar una construcción paso a paso sin omitir detalles de arquitectura).

**Prompt 1 (Setup del Servidor Core y Estado):**
> Actúa como un desarrollador Senior en Node.js. Inicializa un proyecto para un bot de trading algorítmico en Binance Spot. 
> 1. Configura `Express.js` para servir archivos estáticos desde una carpeta `public`.
> 2. Crea los endpoints `/api/start` y `/api/stop` que manipularán una variable global booleana llamada `isBotRunning`. 
> 3. Instala y configura la librería `ws` (WebSockets) y `ccxt`. 
> 4. Cuando `isBotRunning` sea true, inicia una conexión al WebSocket público de Binance (`wss://stream.binance.com:9443/ws/btcusdt@kline_1m`) para capturar las velas de 1 minuto. 
> 5. Estructura el código modularmente y devuélveme el contenido completo de `server.js` y `package.json` con sus dependencias.

**Prompt 2 (Frontend y Panel de Control):**
> Crea el entorno frontend. Construye los archivos `index.html`, `styles.css` y `app.js` dentro de la carpeta `public`. 
> 1. El diseño debe ser un Dashboard financiero moderno, con tema oscuro (Dark Mode), tipografías limpias y alto contraste. 
> 2. Incluye un botón principal grande. Al hacer clic, debe alternar su estado: Si el bot está apagado, dirá 'INICIAR BOT' (color verde) y enviará un POST a `/api/start`. Si está encendido, dirá 'DETENER BOT' (color rojo) y enviará un POST a `/api/stop`. 
> 3. Añade un indicador visual (ej. una luz de estado LED simulada) que muestre el estado de conexión del bot. Muestra el código completo de los 3 archivos.

**Prompt 3 (Motor de Simulación Matemática y RSI):**
> Añade el motor de simulación matemática (Paper Trading) al `server.js`. 
> 1. Define un saldo inicial `virtualBalance = 100` (USDT). 
> 2. Instala la librería `technicalindicators` y úsala para calcular el RSI (14 periodos) en tiempo real con los precios de cierre de las velas de 1 minuto provenientes del WebSocket.
> 3. Lógica de Entrada: Si `isBotRunning` es true, NO hay posición abierta, y el RSI cae por debajo de 30, ejecuta una simulación de compra con los 100 USDT, descontando un 0.1% de comisión inmediatamente.
> 4. Lógica de Salida: Si hay una posición abierta, evalúa cada nuevo precio. Calcula el PNL porcentual neto (ya contemplando la futura comisión de salida del 0.1%). Si la ganancia neta es $\ge$ +0.5%, o la pérdida es $\le$ -0.5% (Stop Loss), simula la venta, actualiza el `virtualBalance`, libera la posición para futuras operaciones e imprime el resultado.

**Prompt 4 (Terminal Holográfica y Server-Sent Events):**
> Configura la transmisión de logs en tiempo real para no depender de la consola del servidor. 
> 1. En `server.js`, crea un endpoint `/api/logs` utilizando Server-Sent Events (SSE). 
> 2. Haz que todas las acciones clave del bot (cálculo de RSI, señales de compra, cálculos de comisión, PNL en tiempo real y ventas) emitan un evento SSE al cliente en lugar de usar solo `console.log`.
> 3. En el frontend (`index.html` y `app.js`), crea un contenedor de "Terminal Holográfica" (fondo negro, texto monoespaciado color verde neón, y scroll automático hacia abajo). 
> 4. Conecta el frontend al SSE e imprime línea por línea cada evento del bot en esta terminal. Asegúrate de que los colores del texto indiquen si es un mensaje de alerta (Stop Loss en rojo), ganancia (Take Profit en verde) o información general (RSI en blanco/gris).