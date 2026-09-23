import pool from './config/db.js';

async function fixUserSubscriptionsTable() {
    try {
        console.log("Adicionando coluna expires_at em user_subscriptions...");
        
        await pool.query(`
            ALTER TABLE user_subscriptions 
            ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
        `);

        console.log("✅ Coluna adicionada com sucesso!");
        process.exit(0);
    } catch(e) {
        console.error("❌ Erro:", e);
        process.exit(1);
    }
}
fixUserSubscriptionsTable();
