import pool from "../config/db.js";
import { v4 as uuidv4 } from 'uuid';

// ✅ Registrar um usuário como afiliado
export const registerAffiliate = async (req, res) => {
    try {
        const { userId, pix_key, pix_beneficiary } = req.body;

        if (!userId || !pix_key || !pix_beneficiary) {
            return res.status(400).json({ success: false, message: "Dados incompletos" });
        }

        // Verifica se já é afiliado
        const check = await pool.query("SELECT * FROM affiliates WHERE user_id = $1", [userId]);
        if (check.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Usuário já é um afiliado" });
        }

        await pool.query(
            "INSERT INTO affiliates (user_id, pix_key, pix_beneficiary) VALUES ($1, $2, $3)",
            [userId, pix_key, pix_beneficiary]
        );

        // Gera um link inicial automaticamente (opcional, mas bom para UX)
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        await pool.query(
            "INSERT INTO affiliate_links (affiliate_id, code) VALUES ($1, $2)",
            [userId, code]
        );

        res.json({ success: true, message: "Credenciamento de afiliado realizado com sucesso!", code });
    } catch (error) {
        console.error("Erro em registerAffiliate:", error);
        res.status(500).json({ success: false, message: "Erro ao processar solicitação" });
    }
};

// ✅ Buscar estatísticas do afiliado
export const getAffiliateStats = async (req, res) => {
    try {
        const userId = req.userId; // Vem do middleware de autenticação

        const affiliateResult = await pool.query(
            "SELECT * FROM affiliates WHERE user_id = $1",
            [userId]
        );

        if (affiliateResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Afiliado não encontrado" });
        }

        const statsResult = await pool.query(
            `SELECT 
                COALESCE(SUM(clicks_count), 0) as total_clicks,
                COALESCE(SUM(conversions_count), 0) as total_conversions
            FROM affiliate_links WHERE affiliate_id = $1`,
            [userId]
        );

        const linksResult = await pool.query(
            "SELECT code, clicks_count, conversions_count FROM affiliate_links WHERE affiliate_id = $1",
            [userId]
        );

        res.json({
            success: true,
            data: {
                ...affiliateResult.rows[0],
                ...statsResult.rows[0],
                links: linksResult.rows
            }
        });
    } catch (error) {
        console.error("Erro em getAffiliateStats:", error);
        res.status(500).json({ success: false, message: "Erro ao buscar estatísticas" });
    }
};

// ✅ Solicitar Saque
export const requestWithdrawal = async (req, res) => {
    try {
        const userId = req.userId;
        const { amount } = req.body;

        const affiliate = await pool.query("SELECT balance, pix_key, pix_beneficiary FROM affiliates WHERE user_id = $1", [userId]);
        
        if (affiliate.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Afiliado não encontrado" });
        }

        const { balance, pix_key, pix_beneficiary } = affiliate.rows[0];

        if (!amount || isNaN(amount) || Number(amount) <= 0) {
            return res.status(400).json({ success: false, message: "Valor de saque inválido" });
        }

        if (Number(amount) > Number(balance)) {
            return res.status(400).json({ success: false, message: "Saldo insuficiente" });
        }

        if (Number(amount) < 20) {
            return res.status(400).json({ success: false, message: "Valor mínimo para saque é R$ 20,00" });
        }

        // Inicia transação para garantir consistência
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Subtrai do saldo
            await client.query(
                "UPDATE affiliates SET balance = balance - $1 WHERE user_id = $2",
                [amount, userId]
            );

            // Registra saque
            await client.query(
                "INSERT INTO affiliate_withdrawals (affiliate_id, amount, pix_key, pix_beneficiary, status) VALUES ($1, $2, $3, $4, 'pendente')",
                [userId, amount, pix_key, pix_beneficiary]
            );

            await client.query('COMMIT');
            res.json({ success: true, message: "Solicitação de saque enviada com sucesso!" });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Erro em requestWithdrawal:", error);
        res.status(500).json({ success: false, message: "Erro ao processar saque" });
    }
};

// ✅ Incrementar clique (chamado pelo front quando alguém acessa o link)
export const trackClick = async (req, res) => {
    try {
        const { code } = req.params;
        await pool.query(
            "UPDATE affiliate_links SET clicks_count = clicks_count + 1 WHERE code = $1",
            [code]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

// ✅ Listar indicados
export const getReferrals = async (req, res) => {
    try {
        const userId = req.userId;
        const result = await pool.query(
            `SELECT u.name, u.email, r.created_at 
             FROM affiliate_referrals r
             JOIN users u ON r.referred_user_id = u.id
             WHERE r.affiliate_id = $1
             ORDER BY r.created_at DESC`,
            [userId]
        );
        res.json({ success: true, referrals: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: "Erro ao buscar indicados" });
    }
};
// ✅ Listar próprios saques (Afiliado)
export const getMyWithdrawals = async (req, res) => {
    try {
        const userId = req.userId;
        const result = await pool.query(
            "SELECT * FROM affiliate_withdrawals WHERE affiliate_id = $1 ORDER BY created_at DESC",
            [userId]
        );
        res.json({ success: true, withdrawals: result.rows });
    } catch (error) {
        console.error("Erro em getMyWithdrawals:", error);
        res.status(500).json({ success: false, message: "Erro ao buscar seus saques" });
    }
};
