# Prompt 22: Blindaje del Pool de Conexiones Neon

Actúa como Senior Backend Developer. El bot se está cayendo por un `Unhandled 'error' event` proveniente de la librería `pg` debido a desconexiones abruptas del pooler de Neon Postgres.

1. Abre `bot/db.js`.
2. Justo debajo de la instanciación de `const pool = new Pool({...})`, añade un listener global para atrapar los errores inactivos: 
`pool.on('error', (err, client) => { console.error('[DB] Error inesperado en cliente inactivo:', err.message); });`
3. Aplica los cambios silenciosamente. Esto evitará que el proceso de Node crashee; el pool de `pg` desechará el cliente dañado y creará uno nuevo automáticamente.