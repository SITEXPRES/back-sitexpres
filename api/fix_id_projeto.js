import pool from './config/db.js';

async function fixIdProjetoType() {
    try {
        console.log("Alterando tipo da coluna id_projeto para VARCHAR(255) em tabelas...");
        
        await pool.query(`
            ALTER TABLE site_prompts ALTER COLUMN id_projeto TYPE VARCHAR(255);
        `).catch(e => console.log("Erro site_prompts:", e.message));

        await pool.query(`
            ALTER TABLE site_analytics ALTER COLUMN id_projeto TYPE VARCHAR(255);
        `).catch(e => console.log("Erro site_analytics:", e.message));
        
        await pool.query(`
            ALTER TABLE hospedagens ADD COLUMN IF NOT EXISTS id_projeto VARCHAR(255);
        `).catch(e => console.log("Erro hospedagens:", e.message));

        console.log("✅ Tipos alterados com sucesso!");
        process.exit(0);
    } catch(e) {
        console.error("❌ Erro:", e);
        process.exit(1);
    }
}
fixIdProjetoType();
