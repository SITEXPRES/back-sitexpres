import pool from "../config/db.js";

/**
 * Atribui comissão a um afiliado se o usuário pagador for um indicado.
 * @param {string} userId - ID do usuário que realizou o pagamento.
 * @param {number} amountPaid - Valor total pago (ex: 29.90).
 * @param {string} orderId - ID da transação/pedido.
 */
export const attributeCommission = async (userId, amountPaid, orderId) => {
    try {
        console.log(`[AffiliateService] Verificando comissão para usuário ${userId}, valor ${amountPaid}`);

        // 1. Verifica se o usuário tem um vínculo de indicação
        const referral = await pool.query(
            "SELECT affiliate_id FROM affiliate_referrals WHERE referred_user_id = $1",
            [userId]
        );

        if (referral.rows.length === 0) {
            console.log(`[AffiliateService] Usuário ${userId} não é indicado por nenhum afiliado.`);
            return;
        }

        const affiliateId = referral.rows[0].affiliate_id;

        // 2. Calcula a comissão (10%)
        const commissionAmount = (parseFloat(amountPaid) * 0.10).toFixed(2);

        // 3. Registra a comissão
        await pool.query(
            `INSERT INTO affiliate_commissions (affiliate_id, referred_user_id, amount, order_id, status) 
             VALUES ($1, $2, $3, $4, 'disponivel')`,
            [affiliateId, userId, commissionAmount, orderId]
        );

        // 4. Atualiza o saldo do afiliado
        await pool.query(
            "UPDATE affiliates SET balance = balance + $1 WHERE user_id = $2",
            [commissionAmount, affiliateId]
        );

        console.log(`✅ [AffiliateService] Comissão de R$ ${commissionAmount} atribuída ao afiliado ${affiliateId}`);

    } catch (error) {
        console.error("❌ [AffiliateService] Erro ao atribuir comissão:", error.message);
        // Não lançamos o erro para não travar o fluxo principal de pagamento
    }
};
