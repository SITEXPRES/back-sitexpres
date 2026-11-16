import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import pool from "../config/db.js";
const router = express.Router();

router.get("/subscription", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT plan, is_active, created_at, updated_at 
             FROM user_subscriptions 
             WHERE user_id = $1
             ORDER BY id DESC LIMIT 1`,
            [req.userId]
        );

        let sub = result.rows.length > 0 ? result.rows[0] : null;

        if (!sub) {
            const newFree = await pool.query(
                `INSERT INTO user_subscriptions (user_id, plan, is_active) 
                 VALUES ($1, 'free', false) RETURNING *`,
                [req.userId]
            );
            sub = newFree.rows[0];
        }

        // Busca última fatura pendente do usuário
        const pendingInvoiceRes = await pool.query(
            `SELECT id, payment_id, credits, monetary_value, value, due_date, status, description, created_at
             FROM public.transactions
             WHERE user_id = $1 AND status = 'pending'
             ORDER BY created_at DESC LIMIT 1`,
            [req.userId]
        );

        const pendingInvoice = pendingInvoiceRes.rows[0] || null;
        let isOverdue = false;
        let diffDays = null;

        if (pendingInvoice && pendingInvoice.due_date) {
            const dueDate = new Date(pendingInvoice.due_date);
            const now = new Date();
            diffDays = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
            if (diffDays <= 0) {
                isOverdue = true;
            }
        }

        // Determina se os serviços estão suspensos (plano free/desativado ou atraso crítico)
        const isSuspended = (!sub.is_active && sub.plan === 'free') || (pendingInvoice && diffDays !== null && diffDays <= -3);

        res.json({
            success: true,
            subscription: {
                ...sub,
                is_active: sub.is_active && !isSuspended,
                has_pending_invoice: !!pendingInvoice,
                pending_invoice: pendingInvoice,
                is_overdue: isOverdue,
                diff_days: diffDays,
                is_suspended: isSuspended
            }
        });
    } catch (error) {
        console.error("Erro ao buscar plano:", error);
        res.status(500).json({
            success: false,
            message: "Erro ao buscar informações do plano"
        });
    }
});

export default router;
