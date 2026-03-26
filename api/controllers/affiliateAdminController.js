import pool from "../config/db.js";

// GET /api/admin/affiliate/withdrawals?status=pendente|pago|cancelado
export const getAllWithdrawals = async (req, res) => {
    try {
        const { status } = req.query;
        
        let query = `
            SELECT w.*, u.name as affiliate_name, u.email as affiliate_email 
            FROM affiliate_withdrawals w
            JOIN users u ON w.affiliate_id = u.id
        `;
        const params = [];

        if (status && ['pendente', 'pago', 'cancelado'].includes(status)) {
            query += ` WHERE w.status = $1`;
            params.push(status);
        }

        query += ` ORDER BY w.created_at DESC`;

        const result = await pool.query(query, params);
        res.json({ success: true, withdrawals: result.rows });
    } catch (error) {
        console.error("Erro em listWithdrawals:", error);
        res.status(500).json({ success: false, message: "Erro ao listar saques" });
    }
};

// GET /api/admin/affiliate/withdrawals/pending-count
export const getPendingCount = async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT COUNT(*) as count FROM affiliate_withdrawals WHERE status = 'pendente'"
        );
        res.json({ success: true, count: parseInt(result.rows[0].count) || 0 });
    } catch (error) {
        console.error("Erro em getPendingWithdrawalsCount:", error);
        res.status(500).json({ success: false, message: "Erro ao contar saques pendentes" });
    }
};

// PUT /api/admin/affiliate/withdrawals/:id
export const updateWithdrawalStatus = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { status } = req.body; // 'pago' ou 'cancelado'

        if (!['pago', 'cancelado'].includes(status)) {
            return res.status(400).json({ success: false, message: "Status inválido. Use 'pago' ou 'cancelado'." });
        }

        await client.query('BEGIN');

        // Busca o saque
        const withdrawalResult = await client.query(
            "SELECT * FROM affiliate_withdrawals WHERE id = $1",
            [id]
        );

        if (withdrawalResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: "Saque não encontrado" });
        }

        const withdrawal = withdrawalResult.rows[0];

        if (withdrawal.status !== 'pendente') {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: "Este saque já foi processado (pago ou cancelado)" });
        }

        // Atualiza o status do saque
        await client.query(
            "UPDATE affiliate_withdrawals SET status = $1, updated_at = NOW() WHERE id = $2",
            [status, id]
        );

        // Se cancelado, devolve o saldo para o afiliado
        if (status === 'cancelado') {
            await client.query(
                "UPDATE affiliates SET balance = balance + $1 WHERE user_id = $2",
                [withdrawal.amount, withdrawal.affiliate_id]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, message: `Saque ${status === 'pago' ? 'confirmado como pago' : 'cancelado e valor estornado'}!` });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erro em updateWithdrawalStatus:", error);
        res.status(500).json({ success: false, message: "Erro ao atualizar status do saque" });
    } finally {
        client.release();
    }
};
