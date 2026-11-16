// api/cron_notificacoes.js
import 'dotenv/config';
import pool from './config/db.js';
import { sendMail } from './services/emailService.js';

function gerarEmailTemplate({
    badgeText,
    badgeBg,
    titulo,
    clienteNome,
    mensagemPrincipal,
    destaques,
    valor,
    botaoTexto,
    botaoUrl,
    alertaAviso,
    rodapeAviso
}) {
    const listaDestaques = (destaques && destaques.length > 0)
        ? `<div style="background: #f8fafc; border-radius: 12px; padding: 18px 22px; margin: 25px 0; border: 1px solid #e2e8f0;">
             <p style="margin: 0 0 10px 0; font-weight: 700; color: #1e293b; font-size: 15px;">Recursos inclusos no seu plano:</p>
             <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.8;">
               ${destaques.map(item => `<li>${item}</li>`).join('')}
             </ul>
           </div>`
        : '';

    const alertaHtml = alertaAviso
        ? `<div style="background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 14px 18px; margin: 20px 0;">
             <p style="margin: 0; color: #991b1b; font-size: 14px; font-weight: 500; line-height: 1.6;">${alertaAviso}</p>
           </div>`
        : '';

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sitexpres</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #f1f5f9;
      margin: 0;
      padding: 30px 15px;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 25px rgba(0, 0, 0, 0.07);
    }
    .email-header {
      background: linear-gradient(135deg, #047bea 0%, #06b6d4 100%);
      padding: 35px 25px;
      text-align: center;
    }
    .email-body {
      padding: 40px 32px;
    }
    .status-badge {
      display: inline-block;
      background: ${badgeBg || '#0284c7'};
      color: #ffffff;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 6px 14px;
      border-radius: 20px;
      margin-bottom: 18px;
    }
    .email-title {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 16px 0;
      line-height: 1.3;
    }
    .email-text {
      font-size: 15px;
      color: #334155;
      line-height: 1.7;
      margin: 0 0 18px 0;
    }
    .cta-container {
      text-align: center;
      margin: 35px 0 25px 0;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #0284c7 0%, #06b6d4 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 16px 36px;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 700;
      box-shadow: 0 4px 15px rgba(6, 182, 212, 0.35);
    }
    .email-footer {
      background: #f8fafc;
      padding: 28px 25px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer-text {
      font-size: 13px;
      color: #64748b;
      margin: 0;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-header">
      <img src="https://sitexpres.com.br/logos/logo1.png" alt="Sitexpres" width="220" style="display: block; margin: 0 auto; max-width: 100%;">
    </div>
    <div class="email-body">
      <div style="text-align: left;">
        <span class="status-badge">${badgeText}</span>
      </div>
      <h1 class="email-title">${titulo}</h1>
      <p class="email-text">Olá, <strong>${clienteNome}</strong>!</p>
      <div class="email-text">${mensagemPrincipal}</div>

      ${alertaHtml}
      ${listaDestaques}

      <div class="cta-container">
        <a href="${botaoUrl}" target="_blank" class="cta-button">${botaoTexto}</a>
      </div>

      <p class="email-text" style="font-size: 13px; color: #64748b; text-align: center;">
        ${rodapeAviso || 'A compensação via PIX é instantânea e reativa seus recursos no mesmo segundo.'}
      </p>
    </div>
    <div class="email-footer">
      <p class="footer-text">
        © 2026 Sitexpres IA & WebHosting. Todos os direitos reservados.<br>
        Você está recebendo este e-mail por ser cliente cadastrado na plataforma Sitexpres.
      </p>
    </div>
  </div>
</body>
</html>
    `;
}

async function notificarClientes() {
    console.log(`--- [${new Date().toLocaleString()}] Iniciando Régua Automática de Cobrança e Bloqueio ---`);
    
    try {
        const frontendUrl = process.env.FRONTEND_URL || 'https://sitexpres.com.br';
        const isTest = process.argv.includes('test');

        if (isTest) console.log("🧪 MODO DE TESTE ATIVADO: Ignorando filtros de data.");
        
        // Busca transações pendentes de clientes
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
                    DATE(t.due_date) = CURRENT_DATE - INTERVAL '1 day' OR
                    DATE(t.due_date) = CURRENT_DATE - INTERVAL '2 days' OR
                    DATE(t.due_date) <= CURRENT_DATE - INTERVAL '3 days'
                )
            `;
        }

        const result = await pool.query(query);
        const faturas = result.rows;

        console.log(`Encontradas ${faturas.length} faturas na régua de cobrança.`);

        for (const fatura of faturas) {
            const hoje = new Date();
            const vencimento = new Date(fatura.due_date || fatura.created_at);
            const diffDias = Math.ceil((vencimento - hoje) / (1000 * 60 * 60 * 24));
            const valorFatura = (parseFloat(fatura.value || fatura.monetary_value) || 29.90).toFixed(2);
            const linkFaturas = `${frontendUrl}/faturas`;

            let assunto = "";
            let emailHtml = "";
            let isDowngrade = false;

            // ─────────────────────────────────────────────────────────────
            // ETAPA 1: D-3 (Faltam 3 dias para o vencimento)
            // ─────────────────────────────────────────────────────────────
            if (diffDias === 3) {
                assunto = `⏳ Sua fatura Sitexpres vence em 3 dias - Mantenha seus sites no ar`;
                emailHtml = gerarEmailTemplate({
                    badgeText: 'Lembrete de Renovação',
                    badgeBg: '#0284c7',
                    titulo: 'Sua assinatura vence em 3 dias! ⏳',
                    clienteNome: fatura.name,
                    valor: valorFatura,
                    mensagemPrincipal: `Lembramos que a fatura de renovação do seu plano no valor de <strong>R$ ${valorFatura}</strong> vence em <strong>3 dias</strong> (${vencimento.toLocaleDateString('pt-BR')}).<br>Garantir o pagamento antecipado evita qualquer risco de instabilidade ou interrupção nos seus sites e domínios.`,
                    destaques: [
                        '<strong>+100 novos créditos</strong> de IA adicionados imediatamente ao seu saldo',
                        '<strong>Hospedagem de alta performance</strong> e domínios oficiais 100% online',
                        '<strong>Exportações liberadas:</strong> Download completo do código (ZIP) e sincronização GitHub'
                    ],
                    botaoTexto: `PAGAR COM PIX (R$ ${valorFatura})`,
                    botaoUrl: linkFaturas,
                    alertaAviso: null,
                    rodapeAviso: 'O pagamento via PIX no painel gera liberação instantânea.'
                });
            }
            // ─────────────────────────────────────────────────────────────
            // ETAPA 2: D-1 (Falta 1 dia - Vence Amanhã)
            // ─────────────────────────────────────────────────────────────
            else if (diffDias === 1) {
                assunto = `⚠️ Atenção: Sua fatura Sitexpres vence amanhã`;
                emailHtml = gerarEmailTemplate({
                    badgeText: 'Vencimento Amanhã',
                    badgeBg: '#f59e0b',
                    titulo: 'Sua mensalidade vence amanhã! ⚠️',
                    clienteNome: fatura.name,
                    valor: valorFatura,
                    mensagemPrincipal: `A sua fatura no valor de <strong>R$ ${valorFatura}</strong> vence <strong>amanhã</strong> (${vencimento.toLocaleDateString('pt-BR')}).<br>Para evitar qualquer bloqueio nos seus sites publicados e manter todas as ferramentas ativas, acerte sua mensalidade diretamente via PIX.`,
                    destaques: [
                        '100 Créditos imediatos creditados no momento do PIX',
                        'Continuidade da hospedagem e dos seus links oficiais',
                        'Acesso irrestrito a exportação de código e push para o GitHub'
                    ],
                    botaoTexto: `PAGAR AGORA VIA PIX`,
                    botaoUrl: linkFaturas,
                    alertaAviso: 'Após o vencimento, o plano entra no período limite de tolerância antes do bloqueio da hospedagem.',
                    rodapeAviso: 'Se você já realizou o pagamento hoje, desconsidere este e-mail.'
                });
            }
            // ─────────────────────────────────────────────────────────────
            // ETAPA 3: D0 (Dia do Vencimento - Vence HOJE)
            // ─────────────────────────────────────────────────────────────
            else if (diffDias === 0) {
                assunto = `🚨 Vence HOJE: Mantenha seus sites e créditos Sitexpres ativos`;
                emailHtml = gerarEmailTemplate({
                    badgeText: 'Vencimento Hoje',
                    badgeBg: '#ea580c',
                    titulo: 'Sua fatura vence HOJE! 🚨',
                    clienteNome: fatura.name,
                    valor: valorFatura,
                    mensagemPrincipal: `Hoje é o dia de vencimento da sua assinatura de <strong>R$ ${valorFatura}</strong>.<br>Mantenha seus clientes acessando seus sites normalmente e garanta mais um mês completo de recursos e 100 créditos de inteligência artificial.`,
                    destaques: [
                        'Liberação imediata de 100 créditos para edições e novos sites',
                        'Hospedagem ativa e sem risco de indisponibilidade',
                        'Código disponível para download e deploy contínuo'
                    ],
                    botaoTexto: `PAGAR FATURA HOJE COM PIX`,
                    botaoUrl: linkFaturas,
                    alertaAviso: 'Evite a perda de benefícios e suspensão do domínio próprio efetuando o pagamento hoje.',
                    rodapeAviso: 'Basta escanear o QR Code no seu internet banking para renovar na hora.'
                });
            }
            // ─────────────────────────────────────────────────────────────
            // ETAPA 4: D+1 (1 dia de atraso - Carência de 48h)
            // ─────────────────────────────────────────────────────────────
            else if (diffDias === -1) {
                assunto = `⚠️ Fatura Vencida: Restam 48h de carência antes do bloqueio dos serviços`;
                emailHtml = gerarEmailTemplate({
                    badgeText: 'Em Carência (48h restantes)',
                    badgeBg: '#dc2626',
                    titulo: 'Sua fatura venceu ontem ⚠️',
                    clienteNome: fatura.name,
                    valor: valorFatura,
                    mensagemPrincipal: `Identificamos que a fatura de <strong>R$ ${valorFatura}</strong> venceu ontem e o pagamento ainda não foi detectado.<br>Você possui <strong>48 horas de tolerância</strong> antes que seus sites, domínio personalizado, hospedagem e ferramentas de exportação sejam congelados.`,
                    destaques: [
                        'Seus sites ainda continuam online durante esta janela de 48h',
                        'Regularize agora para evitar a suspensão do domínio e do download de arquivos',
                        '100 créditos adicionados assim que o PIX for pago'
                    ],
                    botaoTexto: `REGULARIZAR FATURA (R$ ${valorFatura})`,
                    botaoUrl: linkFaturas,
                    alertaAviso: '🚨 Restam menos de 48 horas antes da suspensão automática da sua hospedagem.',
                    rodapeAviso: 'O pagamento é processado instantaneamente via PIX.'
                });
            }
            // ─────────────────────────────────────────────────────────────
            // ETAPA 5: D+2 (2 dias de atraso - Último aviso, 24h restantes)
            // ─────────────────────────────────────────────────────────────
            else if (diffDias === -2) {
                assunto = `🚨 ÚLTIMO AVISO: Seus serviços serão suspensos em 24h`;
                emailHtml = gerarEmailTemplate({
                    badgeText: 'Último Aviso (24h)',
                    badgeBg: '#b91c1c',
                    titulo: 'ÚLTIMO AVISO: Suspensão em 24 horas 🚨',
                    clienteNome: fatura.name,
                    valor: valorFatura,
                    mensagemPrincipal: `O prazo de tolerância está prestes a expirar. Se a fatura de <strong>R$ ${valorFatura}</strong> não for liquidada nas próximas 24 horas, o seu domínio será desvinculado e sua hospedagem será suspensa.`,
                    destaques: [
                        'Evite que seus clientes encontrem seu site fora do ar',
                        'Evite o bloqueio das exportações GitHub e Download ZIP',
                        'Regularização imediata sem taxas ou multas adicionais'
                    ],
                    botaoTexto: `EVITAR SUSPENSÃO IMEDIATA`,
                    botaoUrl: linkFaturas,
                    alertaAviso: '⚠️ Amanhã seus sites e serviços serão colocados em modo suspenso automaticamente pelo sistema.',
                    rodapeAviso: 'Acesse o painel e efetue o pagamento com PIX Copia e Cola.'
                });
            }
            // ─────────────────────────────────────────────────────────────
            // ETAPA 6: D+3 (3 dias de atraso ou mais - BLOQUEIO AUTOMÁTICO)
            // ─────────────────────────────────────────────────────────────
            else if (diffDias <= -3) {
                isDowngrade = true;
                assunto = `🔒 Serviços Suspensos: Conta alterada para o plano Grátis`;
                emailHtml = gerarEmailTemplate({
                    badgeText: 'Serviços Suspensos',
                    badgeBg: '#7f1d1d',
                    titulo: 'Serviços Temporariamente Suspensos 🔒',
                    clienteNome: fatura.name,
                    valor: valorFatura,
                    mensagemPrincipal: `O período de tolerância encerrou-se e sua fatura de <strong>R$ ${valorFatura}</strong> não foi paga.<br>Por esse motivo, os seus recursos premium foram <strong>temporariamente suspensos</strong> e a sua conta retornou ao plano Grátis.`,
                    destaques: [
                        'Hospedagem e domínios oficiais vinculados foram desativados',
                        'Exportação de código (Download ZIP e integração GitHub) bloqueadas',
                        'Geração e edições de sites com Inteligência Artificial pausadas',
                        '<strong>Seus arquivos e dados continuam 100% seguros</strong> aguardando reativação'
                    ],
                    botaoTexto: `REATIVAR HOSPEDAGEM E SERVIÇOS AGORA`,
                    botaoUrl: linkFaturas,
                    alertaAviso: '🔒 Para reativar seu site online e receber 100 créditos no mesmo instante, quite sua fatura pendente no painel.',
                    rodapeAviso: 'Assim que o PIX for pago, todo o sistema é restabelecido automaticamente.'
                });
            } else if (isTest) {
                assunto = `🧪 Teste de Notificação: Fatura ${fatura.payment_id}`;
                emailHtml = `<p>Teste de envio de e-mail para ${fatura.email}. Diff dias: ${diffDias}</p>`;
            } else {
                continue;
            }

            // SE FOR BLOQUEIO (DOWNGRADE D+3)
            if (isDowngrade) {
                console.log(`⚠️ Fatura ${fatura.payment_id} em atraso crítico (${diffDias} dias). Aplicando bloqueio automático para ${fatura.email}`);
                try {
                    // 1. Desativa assinatura do usuário
                    await pool.query(
                        `UPDATE public.user_subscriptions SET plan = 'free', is_active = false, updated_at = NOW() WHERE user_id = $1`,
                        [fatura.user_id]
                    );
                    
                    // 2. Restaura créditos free originais
                    await pool.query(
                        `UPDATE public.users SET credits = COALESCE(free_credits, 0), free_credits = 0 WHERE id = $1`,
                        [fatura.user_id]
                    );
                    
                    // 3. Marca fatura como expirada
                    await pool.query(
                        `UPDATE public.transactions SET status = 'failed', updated_at = NOW() WHERE payment_id = $1`,
                        [fatura.payment_id]
                    );

                    // 4. Bloqueia hospedagens e sites do usuário
                    await pool.query(
                        `UPDATE public.hospedagens SET status = 'suspended' WHERE user_id = $1`,
                        [fatura.user_id]
                    ).catch(e => console.error("Erro ao suspender hospedagens:", e.message));

                    await pool.query(
                        `UPDATE public.sites SET status = 'suspended' WHERE user_id = $1`,
                        [fatura.user_id]
                    ).catch(e => console.error("Erro ao suspender sites:", e.message));
                    
                    console.log(`🔒 Bloqueio efetuado e serviços suspensos para o usuário ${fatura.user_id}`);
                    
                } catch (dwError) {
                    console.error(`❌ Erro ao efetuar bloqueio automático do usuário ${fatura.user_id}:`, dwError.message);
                }
            }

            // Envia o e-mail específico da régua
            try {
                await sendMail(fatura.email, assunto, emailHtml);
                console.log(`✅ [Régua Cobrança] E-mail enviado para ${fatura.email} (diff: ${diffDias}d | assunto: ${assunto})`);
            } catch (mailError) {
                console.error(`❌ Erro ao enviar e-mail para ${fatura.email}:`, mailError.message);
            }
        }

        console.log("--- Fim do Processamento da Régua de Cobrança ---");
    } catch (error) {
        console.error("❌ Erro crítico no cron de cobrança:", error);
    } finally {
        await pool.end();
    }
}

notificarClientes();
