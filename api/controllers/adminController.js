// controllers/paypalController.js
import client from './paypal.js';
import checkoutNodeJssdk from '@paypal/checkout-server-sdk';
import fetch from 'node-fetch';
import 'dotenv/config';
import pool from "../config/db.js";
import { garantirTabelaLog } from "./creditosController.js";
import fs from 'fs/promises';
import path from 'path';


export async function getApiCheck(req, res) {
    try {
        const result = await pool.query(
            "SELECT setting_value FROM public.admin_settings WHERE setting_key = 'maintenance_mode'"
        );
        
        // Verifica se encontrou o registro
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Configuração não encontrada' 
            });
        }
        
        // Pega o valor e converte para boolean
        const raw = String(result.rows[0].setting_value || '').replace(/"/g, '').trim().toLowerCase();
        const maintenanceMode = raw === "true" || raw === "1";
        
        return res.json({ 
            maintenance_mode: maintenanceMode 
        });
        
    } catch (error) {
        console.error('Erro ao buscar configuração:', error);
        return res.status(500).json({ 
            error: 'Erro ao buscar configuração' 
        });
    }
}

export async function getInfo_dom(req, res) {
    try {
        // Busca os 3 valores em uma única query usando IN
        const result = await pool.query(
            `SELECT setting_key, setting_value 
             FROM public.admin_settings 
             WHERE setting_key IN ('dns1', 'dns2', 'server_ip')`
        );
        
        // Verifica se encontrou os registros
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Configurações não encontradas' 
            });
        }
        
        // Cria um objeto com os valores encontrados
        const settings = {};
        result.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });
        
        // Retorna os valores (com valores padrão caso algum não exista)
        return res.json({ 
            dns1: settings.dns1 || null,
            dns2: settings.dns2 || null,
            server_ip: settings.server_ip || null
        });
        
    } catch (error) {
        console.error('Erro ao buscar configurações:', error);
        return res.status(500).json({ 
            error: 'Erro ao buscar configurações' 
        });
    }
}

export async function getPricingPlans(req, res) {
    try {
        const result = await pool.query(
            `SELECT setting_key, setting_value 
             FROM public.admin_settings 
             WHERE setting_key IN (
                 'plan_starter_credits',
                 'plan_starter_price',
                 'plan_pro_credits',
                 'plan_pro_price',
                 'spot_price',
                 'monthly_credits',
                 'monthly_total'
             )`
        );

        const settings = {};
        result.rows.forEach(row => {
            let val = row.setting_value;
            if (typeof val === 'string') {
                try {
                    val = JSON.parse(val);
                } catch (e) {}
            }
            settings[row.setting_key] = val;
        });

        const starterCredits = parseInt(settings.plan_starter_credits) || 100;
        const starterPrice = parseFloat(settings.plan_starter_price) || 29.90;
        const proCredits = parseInt(settings.plan_pro_credits) || 1000;
        const proPrice = parseFloat(settings.plan_pro_price) || 79.90;
        const spotPrice = parseFloat(settings.spot_price) || 1.00;

        return res.json({
            success: true,
            starter: {
                credits: starterCredits,
                price: starterPrice,
                priceFormatted: `R$ ${starterPrice.toFixed(2).replace('.', ',')}`,
                unitPrice: starterCredits > 0 ? (starterPrice / starterCredits).toFixed(2).replace('.', ',') : '0,30'
            },
            pro: {
                credits: proCredits,
                price: proPrice,
                priceFormatted: `R$ ${proPrice.toFixed(2).replace('.', ',')}`,
                unitPrice: proCredits > 0 ? (proPrice / proCredits).toFixed(2).replace('.', ',') : '0,08'
            },
            spot: {
                unitPrice: spotPrice,
                unitPriceFormatted: `R$ ${spotPrice.toFixed(2).replace('.', ',')}`
            }
        });
    } catch (error) {
        console.error('Erro ao buscar planos de preços:', error);
        return res.status(500).json({ error: 'Erro ao buscar planos de preços' });
    }
}

// ========== CONSUMO DE CRÉDITOS (Painel Admin) ==========

export async function verificarAdmin(req, res, next) {
    try {
        const r = await pool.query("SELECT role FROM public.users WHERE id = $1", [req.userId]);
        if (r.rows[0]?.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Acesso restrito ao administrador" });
        }
        next();
    } catch (error) {
        console.error('Erro ao verificar admin:', error);
        res.status(500).json({ success: false, message: "Erro ao verificar permissão" });
    }
}

// Resumo: total geral + consumo por site (créditos, nº de prompts, média por prompt)
export async function getCreditsUsageSummary(req, res) {
    try {
        await garantirTabelaLog();
        const sites = await pool.query(`
            WITH uso AS (
                SELECT id_projeto, user_id,
                       SUM(credits) AS credits, SUM(tokens) AS tokens, MAX(created_at) AS ultimo_uso
                FROM public.credit_usage_log
                WHERE id_projeto IS NOT NULL
                GROUP BY id_projeto, user_id
            ), pr AS (
                SELECT id_projeto::text AS id_projeto, COUNT(*) AS prompts
                FROM public.site_prompts
                GROUP BY id_projeto::text
            )
            SELECT uso.id_projeto, uso.user_id, u.email AS user_email,
                   (SELECT g.name FROM public.generated_sites g
                     WHERE g.id_projeto::text = uso.id_projeto ORDER BY g.created_at DESC LIMIT 1) AS site_name,
                   uso.credits::float AS total_credits, uso.tokens::bigint AS total_tokens,
                   COALESCE(pr.prompts, 0)::int AS total_prompts, uso.ultimo_uso
            FROM uso
            LEFT JOIN pr ON pr.id_projeto = uso.id_projeto
            LEFT JOIN public.users u ON u.id = uso.user_id
            ORDER BY uso.credits DESC
        `);
        const rows = sites.rows.map(r => ({
            ...r,
            avg_credits_per_prompt: r.total_prompts > 0 ? Number((r.total_credits / r.total_prompts).toFixed(2)) : 0
        }));
        const totals = rows.reduce((a, r) => ({
            total_credits: a.total_credits + r.total_credits,
            total_tokens: a.total_tokens + Number(r.total_tokens),
            total_prompts: a.total_prompts + r.total_prompts
        }), { total_credits: 0, total_tokens: 0, total_prompts: 0 });
        totals.total_credits = Number(totals.total_credits.toFixed(2));
        res.json({ success: true, totals, sites: rows });
    } catch (error) {
        console.error('Erro no resumo de créditos:', error);
        res.status(500).json({ success: false, message: "Erro ao buscar consumo de créditos" });
    }
}

// Detalhe de um site: cada prompt com os créditos gastos
export async function getCreditsUsageBySite(req, res) {
    try {
        await garantirTabelaLog();
        const { id_projeto } = req.params;
        const prompts = await pool.query(`
            SELECT sp.id, sp.prompt, sp.status, sp.created_at,
                   COALESCE(SUM(l.credits), 0)::float AS credits,
                   COALESCE(SUM(l.tokens), 0)::bigint AS tokens
            FROM public.site_prompts sp
            LEFT JOIN public.credit_usage_log l ON l.site_prompt_id = sp.id
            WHERE sp.id_projeto::text = $1
            GROUP BY sp.id
            ORDER BY sp.created_at DESC
        `, [String(id_projeto)]);
        const total_credits = Number(prompts.rows.reduce((s, p) => s + p.credits, 0).toFixed(2));
        res.json({ success: true, id_projeto, total_credits, total_prompts: prompts.rows.length, prompts: prompts.rows });
    } catch (error) {
        console.error('Erro no detalhe de créditos:', error);
        res.status(500).json({ success: false, message: "Erro ao buscar prompts do site" });
    }
}