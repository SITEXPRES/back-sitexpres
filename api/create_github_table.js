import pool from './config/db.js';

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS github_integrations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        repo_name VARCHAR(255) NOT NULL,
        github_token VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela github_integrations criada com sucesso.');
    process.exit(0);
  } catch (err) {
    console.error('Erro ao criar tabela:', err);
    process.exit(1);
  }
}
run();
