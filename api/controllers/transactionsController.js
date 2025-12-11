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
        // Se você estiver usando autenticação com middleware (recomendado):
        // const userId = req.user?.id;

        // Caso ainda esteja vindo no body (não recomendado):
        const userId = req.body.userid;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "O campo 'userid' é obrigatório."
            });
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

