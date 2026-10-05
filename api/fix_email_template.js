import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'sitexpress',
});

async function fixEmailTemplate() {
  try {
    const check = await pool.query("SELECT * FROM email_templates WHERE name = 'Recuperação de Senha'");
    
    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Recuperação de Senha - Sitexpres</title>
      <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
        .container { background-color: #ffffff; max-width: 600px; margin: 0 auto; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h2 { color: #333333; }
        p { color: #555555; line-height: 1.6; }
        .btn { display: inline-block; padding: 12px 24px; background-color: #00bcd4; color: #ffffff !important; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 20px; }
        .footer { margin-top: 30px; font-size: 12px; color: #999999; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Recuperação de Senha</h2>
        <p>Olá,</p>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta na Sitexpres. Se você não fez essa solicitação, pode ignorar este e-mail.</p>
        <p>Para criar uma nova senha, clique no botão abaixo:</p>
        <a href="[link_reset]" class="btn">Redefinir Minha Senha</a>
        <p>Ou copie e cole o link abaixo no seu navegador:</p>
        <p><a href="[link_reset]">[link_reset]</a></p>
        <div class="footer">
          <p>&copy; 2026 Sitexpres. Todos os direitos reservados.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    if (check.rows.length === 0) {
      await pool.query(
        "INSERT INTO email_templates (name, subject, body, variables) VALUES ($1, $2, $3, $4)",
        [
          'Recuperação de Senha',
          'Recuperação de Senha - Sitexpres',
          htmlTemplate,
          '["link_reset"]'
        ]
      );
      console.log("✅ Template 'Recuperação de Senha' inserido com sucesso!");
    } else {
      console.log("⚠️ O template já existe no banco.");
    }
  } catch (err) {
    console.error("❌ Erro:", err.message);
  } finally {
    pool.end();
  }
}

fixEmailTemplate();
