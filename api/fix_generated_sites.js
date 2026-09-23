import pool from './config/db.js';

async function fixGeneratedSitesTable() {
    try {
        console.log("Adicionando colunas ausentes em generated_sites...");
        await pool.query(`
            ALTER TABLE generated_sites 
            ADD COLUMN IF NOT EXISTS id_projeto VARCHAR(255),
            ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ativo',
            ADD COLUMN IF NOT EXISTS image_path TEXT,
            ADD COLUMN IF NOT EXISTS subdominio VARCHAR(255);
        `);
        console.log("✅ Colunas adicionadas com sucesso!");
        process.exit(0);
    } catch(e) {
        console.error("❌ Erro:", e);
        process.exit(1);
    }
}
fixGeneratedSitesTable();
