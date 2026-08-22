# Documento Maestro de Arquitectura y Reglas de Negocio: Bot de Scalping Algorítmico (Optimizado)

## 1. Visión General y Objetivo del Proyecto
El objetivo es construir, probar y desplegar un bot de trading algorítmico de alta frecuencia (Scalping) que operará de forma automatizada en el mercado de criptomonedas.
*   **Mercado objetivo:** Binance Spot (Mercado al contado puro, sin margen ni apalancamiento).
*   **Capital de trabajo:** 100 USDT por cada operación.
*   **Interfaz:** Un panel de control (Dashboard web local) que permita arrancar, detener y monitorear las operaciones del bot en tiempo real sin necesidad de interactuar con la consola de comandos del servidor.

## 2. Stack Tecnológico Estricto
La aplicación se dividirá en dos capas claramente definidas:
*   **Backend (Lógica y Conexión):**
    *  Entorno: Node.js nativo.
    *  Servidor web local: Express.js (para servir la interfaz y exponer endpoints de control).
    *  Conexión Exchange: ccxt para interacciones REST (futuras compras/ventas reales) y WebSockets nativos (ws) conectándose a los streams de Binance (wss://stream.binance.com:9443) para lectura de precios y velas en tiempo real con latencia cero.
    *  Indicadores: Librería technicalindicators (o similar) para el cálculo preciso del RSI, EMA y Bandas de Bollinger.
*   **Frontend (Interfaz de Usuario):**
    *  HTML5, CSS3 y Vanilla JavaScript (sin frameworks pesados).
    *  Comunicación en tiempo real: Server-Sent Events (SSE) para transmitir los logs del backend al frontend.

## 3. Lógica Matemática y Reglas Operativas (Modo Paper Trading - Optimizado)
El bot incorpora un motor de simulación interno (`SIMULATION_MODE = true`) para realizar pruebas sin arriesgar capital real. Las reglas de confluencia técnica e ingeniería financiera son estrictas:

*   **Capital Inicial de Simulación:** 100 USDT.
*   **Gestión de Comisiones (Fees):** El motor debe simular la comisión estándar de Binance Spot del **0.1% por cada transacción** (0.1% al comprar y 0.1% al vender).
    *   *Fórmula matemática estricta de Entrada:* Al simular la compra con 100 USDT, se descuenta inmediatamente 0.1% (0.1 USDT). El capital real invertido en la moneda es exactamente de 99.9 USDT.

*   **Gatillo de Entrada (Señal de Compra por Triple Confluencia):**
    Para abrir una operación de compra (`BUY`), el bot debe evaluar de forma sincronizada las velas en tiempo real y requerir el cumplimiento simultáneo de tres (3) filtros técnicos obligatorios:
    1.  **Filtro 1 (RSI 14 periodos en 1m):** El RSI debe estar por debajo de **30**.
    2.  **Filtro 2 (Bandas de Bollinger 20, 2 en 1m):** El precio actual debe ser menor o igual a la Banda Inferior de Bollinger.
    3.  **Filtro 3 (EMA 200 periodos en 5m):** Como protección de tendencia, el precio debe cotizar por encima de la EMA de 200 periodos en 5 minutos.
    *La orden de compra se ejecutará ÚNICA Y EXCLUSIVAMENTE cuando se cumplan las tres condiciones en simultáneo.*

*   **Gatillos de Salida (Toma de Ganancias y Stop Loss Netos):**
    *   **Take Profit (Ganancia Neta +0.5%):** Vender cuando el saldo neto final de retorno sea >= 100.50 USDT (requiere subida bruta aproximada de +0.7013%).
    *   **Stop Loss (Pérdida Máxima -0.5%):** Vender si el saldo neto final de retorno cae a <= 99.50 USDT (se activa con caída bruta de -0.3007%).

*   **Reinicio de Ciclo:** Al cerrar la posición, actualizar el saldo virtual, registrar logs, y volver al estado de escucha esperando nuevamente la triple confluencia.

## 4. Plan de Acción y Fases de Despliegue
*   **Fase 1: Análisis y Arquitectura:** Completada con este documento.
*   **Fase 2: Desarrollo e Integración:** Creación de los módulos backend, frontend, y configuración de los streams de WebSocket.
*   **Fase 3: Pruebas (Paper Trading):** Ejecución del bot en simulación ininterrumpida para validar cálculos, PNL y la efectividad de la triple confluencia.
*   **Fase 4: Paso a Producción:** Inserción de API Keys reales (solo Spot Trading) y transición a ejecución real con monitoreo intensivo de latencia.