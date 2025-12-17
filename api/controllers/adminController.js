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
        const maintenanceMode = result.rows[0].setting_value === "true";
        
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