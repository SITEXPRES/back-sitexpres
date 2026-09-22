import pool from './config/db.js';
async function run() {
    try {
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS credits DECIMAL(10,2) DEFAULT 0;');
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS free_credits DECIMAL(10,2) DEFAULT 0;');
        await pool.query("UPDATE users SET credits = 500 WHERE email = 'admin@sitexpress.com.br';");
        console.log('✅ 500 créditos adicionados ao admin!');
        process.exit(0);
    } catch(e) {
        console.error('Erro:', e.message);
        process.exit(1);
    }
}
run();
