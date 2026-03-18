// api/cron_notificacoes.js
import 'dotenv/config';
import pool from './config/db.js';
import { sendMail } from './services/emailService.js';

async function notificarClientes() {
    console.log(`--- [${new Date().toLocaleString()}] Iniciando Processamento de Notificações ---`);
    
    try {
        const frontendUrl = process.env.FRONTEND_URL || 'https://sitexpres.com.br';
        const isTest = process.argv.includes('test');

        if (isTest) console.log("🧪 MODO DE TESTE ATIVADO: Ignorando filtros de data.");
        
        // Busca transações pendentes
        let query = `
            SELECT t.*, u.email, u.name 
            FROM public.transactions t
            JOIN public.users u ON t.user_id = u.id
            WHERE t.status = 'pending'
        `;

        if (!isTest) {
            query += `
                AND (
                    DATE(t.due_date) = CURRENT_DATE + INTERVAL '3 days' OR
                    DATE(t.due_date) = CURRENT_DATE + INTERVAL '1 day' OR
                    DATE(t.due_date) = CURRENT_DATE OR
                    DATE(t.due_date) <= CURRENT_DATE - INTERVAL '1 day'
                )
            `;
        }

        const result = await pool.query(query);
        const faturas = result.rows;

        console.log(`Encontradas ${faturas.length} faturas para notificar.`);

        for (const fatura of faturas) {
            const hoje = new Date();
            const vencimento = new Date(fatura.due_date || fatura.created_at);
            const diffDias = Math.ceil((vencimento - hoje) / (1000 * 60 * 60 * 24));
            
            let prazoStr = "";
            let isDowngrade = false;

            if (diffDias === 3) prazoStr = "vence em 3 dias";
            else if (diffDias === 1) prazoStr = "vence amanhã";
            else if (diffDias === 0) prazoStr = "vence HOJE";
            else if (diffDias === -1) prazoStr = "venceu ONTEM (restam 2 dias de carência)";
            else if (diffDias === -2) prazoStr = "venceu há 2 DIAS (resta 1 dia de carência)";
            else if (diffDias <= -3) {
                prazoStr = "venceu há 3 dias (Plano Cancelado)";
                isDowngrade = true;
            }
            else if (isTest) {
                prazoStr = `vencimento em ${vencimento.toLocaleDateString('pt-BR')} (diff: ${diffDias} dias)`;
                if (diffDias <= -3) isDowngrade = true;
            }
            else continue; 

            if (isDowngrade) {
                console.log(`⚠️ Fatura ${fatura.payment_id} com atraso crítico (${diffDias} dias). Aplicando downgrade para ${fatura.email}`);
                try {
                    // 1. Muda plano para free e restaura créditos free, zerando o backup
                    await pool.query(
                        `UPDATE public.user_subscriptions SET plan = 'free', updated_at = NOW() WHERE user_id = $1 AND is_active = true`,
                        [fatura.user_id]
                    );
                    
                    await pool.query(
                        `UPDATE public.users SET credits = COALESCE(free_credits, 0), free_credits = 0 WHERE id = $1`,
                        [fatura.user_id]
                    );
                    
                    // 2. Cancela a transação pendente
                    await pool.query(
                        `UPDATE public.transactions SET status = 'failed', updated_at = NOW() WHERE payment_id = $1`,
                        [fatura.payment_id]
                    );
                    
                    console.log(`✅ Downgrade efetuado e créditos restaurados para o usuário ${fatura.user_id}`);
                    
                    // 3. Envia o e-mail avisando o cliente
                    const downgradeAssunto = `⚠️ Aviso Importante: Seu Plano foi Alterado!`;
                    const downgradeMensagemHtml = `<html lang="pt-BR"><head>  <meta charset="UTF-8">  <meta name="viewport" content="width=device-width, initial-scale=1.0">  <title>SITEXPRESS</title>  <style>    body {      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;      background: linear-gradient(135deg, #b3f4fc 0%, #f1fcfc 100%);      margin: 0;      padding: 40px 20px;    }    .selector {      max-width: 600px;      margin: 0 auto 30px;      text-align: center;    }    .selector button {      background: #04ccfc;      color: white;      border: none;      padding: 12px 30px;      margin: 0 10px;      border-radius: 25px;      cursor: pointer;      font-size: 16px;      font-weight: 600;      transition: all 0.3s ease;    }    .selector button:hover {      background: #3cdcfc;      transform: translateY(-2px);      box-shadow: 0 5px 15px rgba(4, 204, 252, 0.3);    }    .selector button.active {      background: #6ae2fc;    }    .email-container {      max-width: 600px;      margin: 0 auto;      background: white;      border-radius: 20px;      overflow: hidden;      box-shadow: 0 10px 40px rgba(4, 204, 252, 0.2);    }    .email-header {      background: linear-gradient(135deg, #047bea 0%, #44f0fc 100%);      padding: 40px 20px;      text-align: center;    }    .logo {      font-size: 36px;      font-weight: 800;      color: white;      margin: 0;      letter-spacing: -1px;    }    .email-body {      padding: 50px 40px;    }    .email-title {      font-size: 28px;      font-weight: 700;      color: #1a1a1a;      margin: 0 0 20px 0;      line-height: 1.3;    }    .email-text {      font-size: 16px;      color: #666;      line-height: 1.8;      margin: 0 0 30px 0;    }    .cta-button {      display: inline-block;      background: linear-gradient(135deg, #04ccfc 0%, #44f0fc 100%);      color: white;      text-decoration: none;      padding: 16px 40px;      border-radius: 30px;      font-size: 16px;      font-weight: 600;      transition: all 0.3s ease;      box-shadow: 0 5px 20px rgba(4, 204, 252, 0.3);    }    .cta-button:hover {      transform: translateY(-2px);      box-shadow: 0 8px 25px rgba(4, 204, 252, 0.4);    }    .info-box {      background: #f1fcfc;      border-left: 4px solid #04ccfc;      padding: 20px;      margin: 30px 0;      border-radius: 8px;    }    .info-box p {      margin: 0;      color: #666;      font-size: 14px;      line-height: 1.6;    }       .email-footer {            margin-top: -70px;            background: #f1fcfc;            padding: 40px;            text-align: center;        }    .social-links {      margin: 20px 0;    }    .social-links a {      display: inline-block;      margin: 0 10px;      text-decoration: none;      transition: transform 0.3s ease;    }    .social-links a:hover {      transform: translateY(-3px);    }    .social-icon {      width: 40px;      height: 40px;      background: white;      border-radius: 50%;      display: inline-flex;      align-items: center;      justify-content: center;      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);    }    .footer-text {      font-size: 13px;      color: #999;      margin: 15px 0 0 0;      line-height: 1.6;    }    .template {      display: none;    }    .template.active {      display: block;    }  </style></head><body>  <div class="template active">    <div class="email-container">      <div class="email-header">        <h1 class="logo">          <img src="https://sitexpres.com.br/logos/logo1.png" alt="" width="400">        </h1>      </div>      <div class="email-body">        <h2 class="email-title">Aviso de Downgrade ⚠️</h2>        <p class="email-text">          Olá, <strong>${fatura.name}</strong>!        </p>        <p class="email-text">          A sua fatura de <strong>R$ ${fatura.value || fatura.monetary_value}</strong> para 50 créditos venceu há 3 dias. Como não identificamos o pagamento, a sua conta foi <strong>automaticamente alterada para o plano Grátis (Free)</strong> e seus créditos gratuitos foram devidamente restaurados.        </p>        <p class="email-text">          Infelizmente, com o plano Grátis, <strong>você perde todos os benefícios exclusivos e limites expandidos</strong> que a plataforma oferece para usuários Premium.        </p>        <p class="email-text">          Para recuperar seus benefícios Premium imediatamente, você pode acessar seu painel e realizar uma nova assinatura a qualquer momento.        </p>        <div style="text-align: center; margin: 40px 0;">          <a href="${frontendUrl}/transactions" target="_blank" class="cta-button">Ver Planos Premium</a>        </div>        <p class="email-text" style="font-size: 13px; color: #888;">          Se você achar que houve um engano e o pagamento já foi realizado, por favor, responda a este e-mail para que possamos ajudar.        </p>        <p class="email-text">          Abraços,<br><strong>Equipe Sitexpres</strong>        </p>      </div>      <div class="email-footer">        <div class="social-links">          <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 20px auto;">            <tr>              <td style="padding: 0 10px;">                <a href="https://x.com/sitexpres" target="_blank" style="text-decoration: none;">                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">                    <tr>                      <td                        style="background-color: #ffffff; width: 40px; height: 40px; border-radius: 50%; text-align: center; vertical-align: middle; box-shadow: 0 3px 10px rgba(0,0,0,0.1);">                        <img src="https://cdn-icons-png.flaticon.com/512/5968/5968830.png" alt="X/Twitter" width="20"                          height="20" style="display: block; margin: 10px auto;">                      </td>                    </tr>                  </table>                </a>              </td>              <td style="padding: 0 10px;">                <a href="https://www.instagram.com/sitexpres/" target="_blank" style="text-decoration: none;">                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">                    <tr>                      <td                        style="background-color: #ffffff; width: 40px; height: 40px; border-radius: 50%; text-align: center; vertical-align: middle; box-shadow: 0 3px 10px rgba(0,0,0,0.1);">                        <img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" alt="Instagram" width="20"                          height="20" style="display: block; margin: 10px auto;">                      </td>                    </tr>                  </table>                </a>              </td>              <td style="padding: 0 10px;">                <a href="https://www.youtube.com/@sitexpres" target="_blank" style="text-decoration: none;">                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">                    <tr>                      <td                        style="background-color: #ffffff; width: 40px; height: 40px; border-radius: 50%; text-align: center; vertical-align: middle; box-shadow: 0 3px 10px rgba(0,0,0,0.1);">                        <img src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" alt="YouTube" width="20"                          height="20" style="display: block; margin: 10px auto;">                      </td>                    </tr>                  </table>                </a>              </td>              <td style="padding: 0 10px;">                <a href="https://www.linkedin.com/company/sitexpres/" target="_blank" style="text-decoration: none;">                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">                    <tr>                      <td                        style="background-color: #ffffff; width: 40px; height: 40px; border-radius: 50%; text-align: center; vertical-align: middle; box-shadow: 0 3px 10px rgba(0,0,0,0.1);">                        <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" alt="LinkedIn" width="20"                          height="20" style="display: block; margin: 10px auto;">                      </td>                    </tr>                  </table>                </a>              </td>            </tr>          </table>        </div>        <p class="footer-text">          © 2026 Sitexpres. Todos os direitos reservados.        </p>      </div>    </div>  </div></body></html>`;
                    await sendMail(fatura.email, downgradeAssunto, downgradeMensagemHtml);
                    console.log(`✅ Aviso de encerramento de plano enviado para ${fatura.email}`);
                    
                } catch (dwError) {
                    console.error(`❌ Erro ao efetuar downgrade do usuário ${fatura.user_id}:`, dwError.message);
                }
                
                // Evita enviar o e-mail de cobrança padrão e continua para o próximo
                continue;
            }

            console.log(`Notificando ${fatura.email} sobre fatura ${fatura.payment_id} (${prazoStr})`);

            const assunto = `💳 Fatura Sitexpress ${prazoStr}!`;
            const mensagemHtml = `
<html lang="pt-BR"><head>  <meta charset="UTF-8">  <meta name="viewport" content="width=device-width, initial-scale=1.0">  <title>SITEXPRESS</title>  <style>    body {      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;      background: linear-gradient(135deg, #b3f4fc 0%, #f1fcfc 100%);      margin: 0;      padding: 40px 20px;    }    .selector {      max-width: 600px;      margin: 0 auto 30px;      text-align: center;    }    .selector button {      background: #04ccfc;      color: white;      border: none;      padding: 12px 30px;      margin: 0 10px;      border-radius: 25px;      cursor: pointer;      font-size: 16px;      font-weight: 600;      transition: all 0.3s ease;    }    .selector button:hover {      background: #3cdcfc;      transform: translateY(-2px);      box-shadow: 0 5px 15px rgba(4, 204, 252, 0.3);    }    .selector button.active {      background: #6ae2fc;    }    .email-container {      max-width: 600px;      margin: 0 auto;      background: white;      border-radius: 20px;      overflow: hidden;      box-shadow: 0 10px 40px rgba(4, 204, 252, 0.2);    }    .email-header {      background: linear-gradient(135deg, #047bea 0%, #44f0fc 100%);      padding: 40px 20px;      text-align: center;    }    .logo {      font-size: 36px;      font-weight: 800;      color: white;      margin: 0;      letter-spacing: -1px;    }    .email-body {      padding: 50px 40px;    }    .email-title {      font-size: 28px;      font-weight: 700;      color: #1a1a1a;      margin: 0 0 20px 0;      line-height: 1.3;    }    .email-text {      font-size: 16px;      color: #666;      line-height: 1.8;      margin: 0 0 30px 0;    }    .cta-button {      display: inline-block;      background: linear-gradient(135deg, #04ccfc 0%, #44f0fc 100%);      color: white;      text-decoration: none;      padding: 16px 40px;      border-radius: 30px;      font-size: 16px;      font-weight: 600;      transition: all 0.3s ease;      box-shadow: 0 5px 20px rgba(4, 204, 252, 0.3);    }    .cta-button:hover {      transform: translateY(-2px);      box-shadow: 0 8px 25px rgba(4, 204, 252, 0.4);    }    .info-box {      background: #f1fcfc;      border-left: 4px solid #04ccfc;      padding: 20px;      margin: 30px 0;      border-radius: 8px;    }    .info-box p {      margin: 0;      color: #666;      font-size: 14px;      line-height: 1.6;    }       .email-footer {            margin-top: -70px;            background: #f1fcfc;            padding: 40px;            text-align: center;        }    .social-links {      margin: 20px 0;    }    .social-links a {      display: inline-block;      margin: 0 10px;      text-decoration: none;      transition: transform 0.3s ease;    }    .social-links a:hover {      transform: translateY(-3px);    }    .social-icon {      width: 40px;      height: 40px;      background: white;      border-radius: 50%;      display: inline-flex;      align-items: center;      justify-content: center;      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);    }    .footer-text {      font-size: 13px;      color: #999;      margin: 15px 0 0 0;      line-height: 1.6;    }    .template {      display: none;    }    .template.active {      display: block;    }  </style></head><body>  <div class="template active">    <div class="email-container">      <div class="email-header">        <h1 class="logo">          <img src="https://sitexpres.com.br/logos/logo1.png" alt="" width="400">        </h1>      </div>      <div class="email-body">
        <h2 class="email-title">Fatura em Aberto! 🎉</h2>        <p class="email-text">          Olá, <strong>${fatura.name}</strong>!        </p>        <p class="email-text">          Lembramos que sua fatura de <strong>R$ ${fatura.value || fatura.monetary_value}</strong> para 50 créditos <strong>${prazoStr}</strong>.        </p>        <p class="email-text">          Para evitar a interrupção dos seus serviços, por favor realize o pagamento através do nosso painel.        </p>        <div style="text-align: center; margin: 40px 0;">          <a href="https://app.sitexpres.com.br/transactions" target="_blank" class="cta-button">ACESSAR TRANSAÇÕES E PAGAR</a>        </div>        <p class="email-text" style="font-size: 13px; color: #888;">          Se você já realizou o pagamento, por favor desconsidere este e-mail. A confirmação via PIX costuma ser instantânea.        </p>        <p class="email-text">          Se precisar de ajuda, nossa equipe está sempre disponível para você.<br>          Abraços, <strong>Equipe Sitexpres</strong>        </p>
      </div>      <div class="email-footer">        <div class="social-links">          <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 20px auto;">            <tr>              <td style="padding: 0 10px;">                <a href="https://x.com/sitexpres" target="_blank" style="text-decoration: none;">                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">                    <tr>                      <td                        style="background-color: #ffffff; width: 40px; height: 40px; border-radius: 50%; text-align: center; vertical-align: middle; box-shadow: 0 3px 10px rgba(0,0,0,0.1);">                        <img src="https://cdn-icons-png.flaticon.com/512/5968/5968830.png" alt="X/Twitter" width="20"                          height="20" style="display: block; margin: 10px auto;">                      </td>                    </tr>                  </table>                </a>              </td>              <td style="padding: 0 10px;">                <a href="https://www.instagram.com/sitexpres/" target="_blank" style="text-decoration: none;">                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">                    <tr>                      <td                        style="background-color: #ffffff; width: 40px; height: 40px; border-radius: 50%; text-align: center; vertical-align: middle; box-shadow: 0 3px 10px rgba(0,0,0,0.1);">                        <img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" alt="Instagram" width="20"                          height="20" style="display: block; margin: 10px auto;">                      </td>                    </tr>                  </table>                </a>              </td>              <td style="padding: 0 10px;">                <a href="https://www.youtube.com/@sitexpres" target="_blank" style="text-decoration: none;">                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">                    <tr>                      <td                        style="background-color: #ffffff; width: 40px; height: 40px; border-radius: 50%; text-align: center; vertical-align: middle; box-shadow: 0 3px 10px rgba(0,0,0,0.1);">                        <img src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" alt="YouTube" width="20"                          height="20" style="display: block; margin: 10px auto;">                      </td>                    </tr>                  </table>                </a>              </td>              <td style="padding: 0 10px;">                <a href="https://www.linkedin.com/company/sitexpres/" target="_blank" style="text-decoration: none;">                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">                    <tr>                      <td                        style="background-color: #ffffff; width: 40px; height: 40px; border-radius: 50%; text-align: center; vertical-align: middle; box-shadow: 0 3px 10px rgba(0,0,0,0.1);">                        <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" alt="LinkedIn" width="20"                          height="20" style="display: block; margin: 10px auto;">                      </td>                    </tr>                  </table>                </a>              </td>            </tr>          </table>        </div>        <p class="footer-text">          © 2026 Sitexpres. Todos os direitos reservados.<br>          Você está recebendo este email porque se cadastrou em nossa plataforma.        </p>      </div>    </div>  </div></body></html>
            `;

            try {
                await sendMail(fatura.email, assunto, mensagemHtml);
                console.log(`✅ E-mail enviado com sucesso para ${fatura.email}`);
            } catch (mailError) {
                console.error(`❌ Erro ao enviar e-mail para ${fatura.email}:`, mailError.message);
            }
        }

        console.log("--- Fim do Processamento ---");
    } catch (error) {
        console.error("❌ Erro crítico no cron de notificações:", error);
    } finally {
        // Encerra o pool para que o script finalize
        await pool.end();
    }
}

notificarClientes();
