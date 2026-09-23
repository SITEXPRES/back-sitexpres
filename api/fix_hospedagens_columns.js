import pool from './config/db.js';

async function fixHospedagensTable() {
    try {
        console.log("Adicionando colunas que faltavam na tabela hospedagens...");
        
        await pool.query(`
            ALTER TABLE hospedagens
            ADD COLUMN IF NOT EXISTS id_user VARCHAR(255),
            ADD COLUMN IF NOT EXISTS dominio VARCHAR(255),
            ADD COLUMN IF NOT EXISTS username VARCHAR(255),
            ADD COLUMN IF NOT EXISTS senha VARCHAR(255),
            ADD COLUMN IF NOT EXISTS email VARCHAR(255),
            ADD COLUMN IF NOT EXISTS nome VARCHAR(255),
            ADD COLUMN IF NOT EXISTS pacote VARCHAR(255),
            ADD COLUMN IF NOT EXISTS bandwidth VARCHAR(255),
            ADD COLUMN IF NOT EXISTS quota VARCHAR(255),
            ADD COLUMN IF NOT EXISTS ip VARCHAR(255),
            ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS site_uploaded BOOLEAN DEFAULT false;
        `);

        console.log("✅ Colunas da tabela hospedagens adicionadas com sucesso!");
        process.exit(0);
    } catch(e) {
        console.error("❌ Erro:", e.message);
        process.exit(1);
    }
}
fixHospedagensTable();
