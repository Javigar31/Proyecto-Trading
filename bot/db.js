const { Pool } = require('pg');

// Configuración del Pool de conexiones
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

/**
 * Inicializa la base de datos creando las tablas si no existen
 * y asegura que haya un balance inicial.
 */
async function initDB() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Tabla de estado del bot (para guardar el balance global)
        await client.query(`
            CREATE TABLE IF NOT EXISTS bot_state (
                id SERIAL PRIMARY KEY,
                virtual_balance NUMERIC(15, 2) NOT NULL DEFAULT 100.00
            );
        `);

        // Tabla de historial de operaciones (trades)
        await client.query(`
            CREATE TABLE IF NOT EXISTS trade_history (
                id SERIAL PRIMARY KEY,
                symbol VARCHAR(20) NOT NULL,
                buy_price NUMERIC(20, 8) NOT NULL,
                sell_price NUMERIC(20, 8) NOT NULL,
                exit_reason VARCHAR(20) NOT NULL,
                profit_usdt NUMERIC(15, 2) NOT NULL,
                closed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Insertar el balance inicial si la tabla está vacía
        const res = await client.query('SELECT id FROM bot_state WHERE id = 1;');
        if (res.rows.length === 0) {
            await client.query('INSERT INTO bot_state (id, virtual_balance) VALUES (1, 100.00);');
        }

        await client.query('COMMIT');
        console.log('[DB] Base de datos inicializada correctamente.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[DB] Error al inicializar la base de datos:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Obtiene el balance actual de la base de datos.
 */
async function getBalance() {
    const res = await pool.query('SELECT virtual_balance FROM bot_state WHERE id = 1;');
    return parseFloat(res.rows[0].virtual_balance);
}

/**
 * Actualiza el balance en la base de datos.
 */
async function updateBalance(newBalance) {
    await pool.query('UPDATE bot_state SET virtual_balance = $1 WHERE id = 1;', [newBalance]);
}

/**
 * Guarda los detalles de una operación cerrada.
 */
async function saveTrade(tradeData) {
    const { symbol, buyPrice, sellPrice, exitReason, profitUsdt } = tradeData;
    await pool.query(
        `INSERT INTO trade_history (symbol, buy_price, sell_price, exit_reason, profit_usdt) 
         VALUES ($1, $2, $3, $4, $5);`,
        [symbol, buyPrice, sellPrice, exitReason, profitUsdt]
    );
}

module.exports = {
    pool,
    initDB,
    getBalance,
    updateBalance,
    saveTrade
};
