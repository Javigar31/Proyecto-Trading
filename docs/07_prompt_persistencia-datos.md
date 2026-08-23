# Prompt 7: Persistencia de Datos con PostgreSQL (Neon)

Actúa como un Desarrollador Senior de Node.js y Arquitecto de Bases de Datos. Tu objetivo es implementar la persistencia de datos en nuestro bot de scalping conectándolo a una base de datos PostgreSQL en Neon. Debes escribir y modificar el código de forma completamente autónoma siguiendo estas directrices, sin que yo tenga que proporcionarte fragmentos de código:

**1. Instalación de dependencias:** 
Abre la terminal e instala los paquetes `pg` y `dotenv`.

**2. Configuración de entorno:** 
Crea un archivo `.env` en la raíz del proyecto. Define la variable `DATABASE_URL` asignándole exactamente este valor: 
`postgresql://neondb_owner:npg_M0iN1BgKFODx@ep-divine-cake-b2propai-pooler.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`

**3. Nuevo módulo de base de datos (`bot/db.js`):** 
Crea este archivo. Configura un Pool de conexiones de `pg` usando la variable de entorno de la base de datos y deshabilitando el rechazo de certificados SSL (`rejectUnauthorized: false`).
- Implementa una función `initDB` que cree dos tablas si no existen: `bot_state` (con un `id` serial y un `virtual_balance` numérico por defecto en 100.00) y `trade_history` (para guardar symbol, buy_price, sell_price, exit_reason, profit_usdt y fecha).
- Dentro de `initDB`, verifica si el registro del balance inicial existe en `bot_state` (id = 1); si no existe, insértalo.
- Crea y exporta funciones adicionales para obtener el balance actual (`getBalance`), actualizar el balance (`updateBalance`) y guardar los detalles de una operación (`saveTrade`).

**4. Integración en el motor (`bot/simulator.js`):** 
Importa `dotenv` al inicio y tu nuevo módulo `db.js`.
- Modifica el método `warmup()` para que primero espere la ejecución de `initDB()`. Luego, obtén el balance desde la base de datos, asígnalo a `state.virtualBalance` y emite un log informando el balance cargado.
- En el método `executeSell`, inmediatamente después de sumarle el profit al balance virtual del estado, ejecuta de forma asíncrona (usando `.catch()` para no bloquear el hilo principal en caso de error) las funciones `updateBalance` y `saveTrade` para guardar el estado actual y los detalles de la operación recién cerrada.

Analiza estos requerimientos, genera toda la sintaxis necesaria tú mismo, aplica los cambios directamente en los archivos correspondientes y avísame cuando el sistema esté listo para reiniciarse.