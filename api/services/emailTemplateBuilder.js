export function buildStyledEmail(title, userName, bodyHtml, ctaText, ctaLink) {
  return `
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SITEXPRESS</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background: linear-gradient(135deg, #b3f4fc 0%, #f1fcfc 100%); margin: 0; padding: 40px 20px; }
    .email-container { max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(4, 204, 252, 0.2); }
    .email-header { background: linear-gradient(135deg, #047bea 0%, #44f0fc 100%); padding: 40px 20px; text-align: center; }
    .logo { font-size: 36px; font-weight: 800; color: white; margin: 0; letter-spacing: -1px; }
    .email-body { padding: 50px 40px; }
    .email-title { font-size: 28px; font-weight: 700; color: #1a1a1a; margin: 0 0 20px 0; line-height: 1.3; }
    .email-text { font-size: 16px; color: #666; line-height: 1.8; margin: 0 0 15px 0; }
    .chave-box { background-color: #f1fcfc; border-left: 4px solid #04ccfc; padding: 15px; margin: 20px 0; border-radius: 8px; font-size: 14px; font-family: monospace; font-weight: bold; overflow-wrap: break-word; color: #1a1a1a;}
    .cta-button { display: inline-block; background: linear-gradient(135deg, #04ccfc 0%, #44f0fc 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 30px; font-size: 16px; font-weight: 600; transition: all 0.3s ease; box-shadow: 0 5px 20px rgba(4, 204, 252, 0.3); }
    .email-footer { background: #f1fcfc; padding: 40px; text-align: center; }
    .footer-text { font-size: 13px; color: #999; margin: 0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1 class="logo">
        <img src="https://sitexpres.com.br/logos/logo1.png" alt="Sitexpress" width="400" style="max-width: 100%;">
      </h1>
    </div>
    <div class="email-body">
      <h2 class="email-title">${title}</h2>
      <p class="email-text">
        Olá, <strong>${userName}</strong>!
      </p>
      ${bodyHtml}
      <div style="text-align: center; margin: 40px 0;">
        <a href="${ctaLink}" target="_blank" class="cta-button">${ctaText}</a>
      </div>
      <p class="email-text" style="margin-top: 30px;">
        Abraços,<br><strong>Equipe Sitexpres</strong>
      </p>
    </div>
    <div class="email-footer">
      <p class="footer-text">
        © 2026 Sitexpres. Todos os direitos reservados.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}
