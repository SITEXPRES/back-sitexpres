import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ajuste conforme suas variáveis de ambiente no WSL/Local
const pool = new pg.Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'sitexpress',
});

async function importSite() {
  const email = 'josue123201856@gmail.com';
  const subdominio = 'sugestodesubdom'; // O subdomínio desejado
  
  try {
    // 1. Busca o usuário
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      console.error(`❌ Usuário não encontrado com e-mail: ${email}`);
      process.exit(1);
    }
    const userId = userRes.rows[0].id;
    console.log(`✅ Usuário encontrado! ID: ${userId}`);

    // 2. Lê o HTML do arquivo cloudx.html
    const htmlPath = path.join(__dirname, 'cloudx.html');
    if (!fs.existsSync(htmlPath)) {
      console.error(`❌ Arquivo HTML não encontrado em: ${htmlPath}`);
      process.exit(1);
    }
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    // 3. Gera um ID de Projeto Único
    const { v4: uuidv4 } = await import('uuid');
    const idProjeto = uuidv4();
    
    // 4. Insere o site na tabela generated_sites
    console.log(`🚀 Inserindo site para o subdomínio: ${subdominio}.sitexpres.com.br...`);
    
    const insertRes = await pool.query(
      `INSERT INTO generated_sites 
       (user_id, name, prompt, html_content, id_projeto, subdominio, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name`,
      [
        userId, 
        `CloudX Oficial`, 
        `Site de hospedagem CloudX gerado manualmente.`, 
        htmlContent, 
        idProjeto, 
        subdominio, 
        'ativo'
      ]
    );

    console.log(`✅ Site inserido com sucesso! ID no banco: ${insertRes.rows[0].id}`);
    console.log(`🔗 Agora o usuário verá esse site no painel dele, atrelado ao subdomínio.`);

  } catch (err) {
    console.error('❌ Erro durante a importação:', err);
  } finally {
    pool.end();
  }
}

importSite();
