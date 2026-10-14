// controllers/paypalController.js
import client from './paypal.js';
import checkoutNodeJssdk from '@paypal/checkout-server-sdk';
import fetch from 'node-fetch';
import 'dotenv/config';
import pool from "../config/db.js";
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