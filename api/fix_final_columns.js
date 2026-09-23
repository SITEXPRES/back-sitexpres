import pool from './config/db.js';

async function fixFinalColumns() {
    try {
        console.log("Adicionando colunas que ainda possam estar faltando...");
        
        await pool.query(`
            ALTER TABLE generated_sites 
            ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;
        `).catch(e => console.log("Erro generated_sites:", e.message));

        await pool.query(`
            ALTER TABLE sites
            ADD COLUMN IF NOT EXISTS site_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS site_url VARCHAR(255),
            ADD COLUMN IF NOT EXISTS credits_used DECIMAL(10,2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS metadata TEXT,
            ADD COLUMN IF NOT EXISTS id_projeto VARCHAR(255);
        `).catch(e => console.log("Erro sites:", e.message));

        await pool.query(`
            ALTER TABLE hospedagens
            ADD COLUMN IF NOT EXISTS id_projeto VARCHAR(255);
        `).catch(e => console.log("Erro hospedagens:", e.message));

        console.log("✅ Colunas finais verificadas e adicionadas!");
        process.exit(0);
    } catch(e) {
        console.error("❌ Erro:", e);
        process.exit(1);
    }
}
fixFinalColumns();
