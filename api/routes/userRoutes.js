import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import pool from "../config/db.js";
const router = express.Router();

router.get("/subscription", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT plan, is_active, expires_at 
       FROM user_subscriptions 
       WHERE user_id = $1 and is_active = true
       ORDER BY id DESC LIMIT 1`,
            [req.userId]
        );

        if (result.rows.length === 0) {
            // Usuário sem plano, cria um plano free
            await pool.query(
                `INSERT INTO user_subscriptions (user_id, plan) 
         VALUES ($1, 'free')`,
                [req.userId]
            );

            return res.json({
                success: true,
                subscription: { plan: 'free', is_active: true }
            });
        }

        res.json({
            success: true,
            subscription: result.rows[0]
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
