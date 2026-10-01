import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'sitexpress',
});

async function fixPromptHistory() {
  try {
    // 1. Achar o site manual que criamos
    const siteRes = await pool.query(
      "SELECT id, id_projeto, prompt FROM generated_sites WHERE name = 'CloudX Oficial' ORDER BY id DESC LIMIT 1"
    );

    if (siteRes.rows.length === 0) {
      console.log("❌ Site manual não encontrado.");
      process.exit(1);
    }

    const { id, id_projeto, prompt } = siteRes.rows[0];

    // 2. Inserir na tabela site_prompts
    const check = await pool.query(
      "SELECT id FROM site_prompts WHERE id_projeto = $1",
      [id_projeto]
    );

    if (check.rows.length === 0) {
      await pool.query(
        "INSERT INTO site_prompts (id_projeto, prompt, id_site_gererate, status) VALUES ($1, $2, $3, $4)",
        [id_projeto, prompt, id, 'ativo']
      );
      console.log("✅ Histórico de prompt adicionado com sucesso!");
    } else {
      console.log("⚠️ O histórico de prompt já existe para esse projeto.");
    }
  } catch (err) {
    console.error("❌ Erro:", err.message);
  } finally {
    pool.end();
  }
}

fixPromptHistory();
