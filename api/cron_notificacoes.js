// api/cron_notificacoes.js
import 'dotenv/config';
import pool from './config/db.js';
import { sendMail } from './services/emailService.js';

async function notificarClientes() {
    console.log(`--- [${new Date().toLocaleString()}] Iniciando Processamento de Notificações ---`);
    
    try {
        const frontendUrl = process.env.FRONTEND_URL || 'https://sitexpres.com.br';
        
        // Busca transações pendentes que vencem em 3 dias, 1 dia ou hoje
        // Consideramos 'created_at' como a data de vencimento para faturas PENDING-REG
        const query = `
            SELECT t.*, u.email, u.name 
            FROM public.transactions t
            JOIN public.users u ON t.user_id = u.id
            WHERE t.status = 'pending'
            AND (
                DATE(t.created_at) = CURRENT_DATE + INTERVAL '3 days' OR
                DATE(t.created_at) = CURRENT_DATE + INTERVAL '1 day' OR
                DATE(t.created_at) = CURRENT_DATE
            )
        `;

        const result = await pool.query(query);
        const faturas = result.rows;

        console.log(`Encontradas ${faturas.length} faturas para notificar.`);

        for (const fatura of faturas) {
            const hoje = new Date();
            const vencimento = new Date(fatura.created_at);
            const diffDias = Math.ceil((vencimento - hoje) / (1000 * 60 * 60 * 24));
            
            let prazoStr = "";
            if (diffDias === 3) prazoStr = "vence em 3 dias";
            else if (diffDias === 1) prazoStr = "vence amanhã";
            else if (diffDias <= 0) prazoStr = "vence HOJE";
            else continue; // Caso a query pegue algo fora do range por preciosismo de horas

            console.log(`Notificando ${fatura.email} sobre fatura ${fatura.payment_id} (${prazoStr})`);

            const assunto = `💳 Sua fatura Sitexpress ${prazoStr}!`;
            const mensagemHtml = `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #4f46e5;">Olá, ${fatura.name}!</h2>
                    <p>Lembramos que sua fatura de <strong>R$ ${fatura.value || fatura.monetary_value}</strong> para 50 créditos <strong>${prazoStr}</strong>.</p>
                    <p>Para evitar a interrupção dos seus serviços, por favor realize o pagamento através do nosso painel.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${frontendUrl}/transactions" style="background-color: #4f46e5; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">ACESSAR TRANSAÇÕES E PAGAR</a>
                    </div>
                    <p style="font-size: 12px; color: #666;">Se você já realizou o pagamento, por favor desconsidere este e-mail. A confirmação via PIX costuma ser instantânea.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="text-align: center; color: #999; font-size: 12px;">Sitexpress - Soluções Inteligentes</p>
                </div>
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
