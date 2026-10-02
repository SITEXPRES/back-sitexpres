import pool from './config/db.js';

async function run() {
  try {
    console.log("Verificando e adicionando coluna assistant_message em site_prompts...");
    await pool.query(`ALTER TABLE public.site_prompts ADD COLUMN IF NOT EXISTS assistant_message TEXT;`);
    console.log("✅ Coluna assistant_message adicionada/verificada com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao adicionar coluna assistant_message:", error.message);
    process.exit(1);
  }
}

run();
