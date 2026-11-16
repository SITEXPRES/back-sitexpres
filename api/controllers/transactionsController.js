// controllers/paypalController.js
import client from './paypal.js';
import checkoutNodeJssdk from '@paypal/checkout-server-sdk';
import fetch from 'node-fetch';
import 'dotenv/config';
import pool from "../config/db.js";
import fs from 'fs/promises';
import path from 'path';



export async function transactions_list(req, res) {
    try {
        const userId = req.body.userid || req.user?.id;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "O campo 'userid' é obrigatório."
            });
        }

        // Auto-correção: Atualizar faturas pendentes de mensalidade que ficaram com 50 créditos para o novo plano de 100 créditos
        try {
            await pool.query(`
                UPDATE public.transactions
                SET credits = 100
                WHERE user_id = $1 
                  AND status = 'pending' 
                  AND (credits <= 50 OR credits IS NULL)
                  AND (
                    monetary_value >= 29.90 
                    OR value >= 29.90 
                    OR description ILIKE '%Mensalidade%' 
                    OR description ILIKE '%Ciclo%'
                    OR description ILIKE '%Compra%'
                  )
            `, [userId]);
        } catch (updateErr) {
            console.warn("Aviso ao atualizar créditos da fatura pendente:", updateErr.message);
        }

        const query = `
            SELECT *
            FROM public.transactions
            WHERE user_id = $1
            ORDER BY created_at DESC
        `;

        const result = await pool.query(query, [userId]);

        return res.status(200).json({
            success: true,
            total: result.rowCount,
            transactions: result.rows
        });

    } catch (error) {
        console.error("Erro ao listar transações:", error);

        return res.status(500).json({
            success: false,
            message: "Erro interno ao buscar transações.",
            error: error.message
        });
    }
}

