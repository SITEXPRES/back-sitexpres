import axios from 'axios';
import crypto from 'crypto';
import pool from '../config/db.js';

import FormData from 'form-data';
import Client from 'ftp';
import fs from 'fs';
import path from 'path';
import { deletarSubdominioDirectAdmin } from './integracao_directadmin.js';

// Configurações do DirectAdmin
const DIRECTADMIN_CONFIG = {
    host: `https://${process.env.host_directadmin || 'srv3br.com.br'}:2222`,
    username: process.env.user_directamin || '',
    password: process.env.pass_directamin || '',
    creator: process.env.DIRECTADMIN_CREATOR || ''
};

/**
 * Gera um username válido baseado no nome
 * Remove acentos, espaços e caracteres especiais
 * @param {string} nome - Nome completo
 * @returns {string} Username válido
 */
const gerarUsername = (nome) => {
    if (!nome) return `user${Date.now()}`;

    let username = nome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 16);

    if (username.length < 3) {
        username = `user${Math.random().toString(36).substring(2, 8)}`;
    }

    return username;
};

/**
 * Gera uma senha segura aleatória
 * @param {string} nome - Nome do usuário
 * @param {string} email - Email do usuário
 * @returns {string} Senha gerada
 */
const gerarSenha = (nome, email) => {
    const baseString = `${nome}${email}${Date.now()}${Math.random()}`;
    const hash = crypto.createHash('sha256').update(baseString).digest('hex');

    const parte1 = hash.substring(0, 4);
    const parte2 = hash.substring(8, 12);
    const numero = Math.floor(Math.random() * 9999);

    const maiuscula = parte1.toUpperCase();
    const minuscula = parte2.toLowerCase();
    const especial = ['!', '@', '#', '$'][Math.floor(Math.random() * 4)];

    return `${maiuscula}${minuscula}${numero}${especial}`;
};

function normalizarUsername(texto) {
    return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase();
}

/**
 * Verifica se o username já existe no DirectAdmin
 * @param {string} username - Username para verificar
 * @returns {Promise<boolean>}
 */
const usernameExiste = async (username) => {
    try {
        const response = await axios.get(
            `${DIRECTADMIN_CONFIG.host}/CMD_API_SHOW_USERS`,
            {
                auth: {
                    username: DIRECTADMIN_CONFIG.username,
                    password: DIRECTADMIN_CONFIG.password
                },
                timeout: 10000
            }
        );

        const usuarios = response.data.split('\n').filter(u => u.trim());
        return usuarios.includes(username);
    } catch (error) {
        console.error('Erro ao verificar username:', error);
        return false;
    }
};

/**
 * Gera um username único que não existe no DirectAdmin
 * @param {string} nomeBase - Nome base para gerar o username
 * @returns {Promise<string>}
 */
const gerarUsernameUnico = async (nomeBase) => {
    const base = normalizarUsername(nomeBase).substring(0, 12);

    let username = base;
    let contador = 1;

    while (await usernameExiste(username)) {
        const sufixo = String(contador).padStart(2, '0');
        username = `${base.substring(0, 14 - sufixo.length)}${sufixo}`;
        contador++;
    }

    return username;
};


/**
 * Cria uma nova conta de hospedagem no DirectAdmin
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const creat_hospedagem = async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            dominio,
            nome,
            email,
            bandwidth,
            quota,
            ip,
            id_projeto,
            id_user

        } = req.body;

        console.log('📥 Dados recebidos:', { dominio, nome, email });

        // Validação dos campos obrigatórios
        if (!dominio) {
            return res.status(400).json({
                success: false,
                message: 'Domínio é obrigatório'
            });
        }

        if (!nome) {
            return res.status(400).json({
                success: false,
                message: 'Nome é obrigatório'
            });
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email é obrigatório'
            });
        }

        // Gera username único e senha
        const sufixo = Math.floor(Math.random() * 999) + 1;
        const username = `${await gerarUsernameUnico(nome)}${sufixo}`;
        const senha = gerarSenha(nome, email);

        console.log('🔑 Credenciais geradas:', { username, senha: '***' });

        const pacote = process.env.DIRECTADMIN_PACK;

        console.log('📦 Configuração DirectAdmin:', {
            host: DIRECTADMIN_CONFIG.host,
            user: DIRECTADMIN_CONFIG.username,
            pacote: pacote || 'packagesitexpress'
        });

        // Preparar dados para a API do DirectAdmin
        const params = new URLSearchParams({
            action: 'create',
            add: 'Submit',
            username: username,
            email: email,
            passwd: senha,
            passwd2: senha,
            domain: dominio,
            package: pacote || 'packagesitexpress',
            ip: '143.208.8.36',
            notify: 'no',
            send_email: 'no'
        });

        // Se não usar pacote, definir limites manualmente
        if (!pacote) {
            params.append('bandwidth', bandwidth || 'unlimited');
            params.append('quota', quota || 'unlimited');
            params.append('vdomains', 'unlimited');
            params.append('nsubdomains', 'unlimited');
            params.append('nemails', 'unlimited');
            params.append('nemailf', 'unlimited');
            params.append('nemailml', 'unlimited');
            params.append('nemailr', 'unlimited');
            params.append('mysql', 'unlimited');
            params.append('domainptr', 'unlimited');
            params.append('ftp', 'unlimited');
        }

        // Fazer requisição para a API do DirectAdmin
        const response = await axios.post(
            `${DIRECTADMIN_CONFIG.host}/CMD_API_ACCOUNT_USER`,
            params.toString(),
            {
                auth: {
                    username: DIRECTADMIN_CONFIG.username,
                    password: DIRECTADMIN_CONFIG.password
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 30000
            }
        );

        // Log para debug
        console.log('📡 Resposta DirectAdmin:', response.data);
        console.log('📡 Tipo da resposta:', typeof response.data);
        console.log('📡 Status:', response.status);

        // Verificar se a conta foi criada com sucesso
        const respostaString = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        const sucesso = response.data.error === '0' ||
            response.data.error === 0 ||
            respostaString.includes('Account Created') ||
            respostaString.includes('User Created') ||
            response.status === 200;

        if (sucesso) {
            console.log('✅ Conta criada com sucesso, iniciando upload do site...');

            // Upload do index.html para public_html
            let uploadStatus = { success: false, message: '' };


            //Consultar html no Banco
            let htmlContent = "";

            const existing = await client.query(
                `SELECT html_content FROM generated_sites 
                WHERE id_projeto = $1 
                ORDER BY created_at DESC LIMIT 1`,
                [id_projeto]
            );

            if (existing.rows.length > 0 && existing.rows[0]?.html_content) {
                htmlContent = existing.rows[0].html_content;
                console.log('✅ HTML encontrado no banco de dados');
            }

            if (htmlContent) {
                try {
                    uploadStatus = await uploadIndexHtml(username, senha, dominio, htmlContent);
                    console.log('📤 Status do upload:', uploadStatus);

                    //Removendo Subdominio

                    const dados_site = await client.query(
                        `SELECT id_projeto, site_url FROM public.sites WHERE id_projeto = $1`,
                        [id_projeto]
                    );

                    // Verificar se encontrou o site
                    if (dados_site.rows.length === 0) {
                        console.log('⚠️ Site não encontrado para remover subdomínio');
                    } else {
                        const siteUrl = dados_site.rows[0].site_url;

                        // Extrair apenas o subdomínio (parte antes do domínio principal)
                        const urlLimpa = siteUrl
                            .replace('https://', '')
                            .replace('http://', '')
                            .replace(/\/$/, '')
                            .trim();

                        // Separar subdomínio do domínio principal
                        // apostasesp.sitexpres.com.br → subdominio: apostasesp, dominio: sitexpres.com.br
                        const partes = urlLimpa.split('.');
                        const subdomain = partes[0]; // apostasesp
                        const dominioPrincipal = partes.slice(1).join('.'); // sitexpres.com.br

                        console.log('🗑️ Removendo subdomínio:', subdomain);
                        console.log('📌 Domínio principal:', dominioPrincipal);

                        try {
                            const resultado = await deletarSubdominioDirectAdmin(
                                subdomain);

                            console.log('✅ Subdomínio removido com sucesso:', resultado);
                        } catch (error) {
                            console.error('❌ Erro ao remover subdomínio:', error.message);
                            // Não quebra o fluxo, apenas loga o erro
                        }
                    }

                } catch (uploadError) {
                    console.error('❌ Erro no upload do arquivo:', uploadError);
                    uploadStatus = {
                        success: false,
                        message: uploadError.message
                    };
                }
            }

            // Salvar informações no banco de dados PostgreSQL
            await client.query('BEGIN');

            try {
                const insertQuery = `
          INSERT INTO hospedagens 
          (dominio, username, senha, email, nome, pacote, bandwidth, quota, ip, criado_em, id_projeto, id_user, site_uploaded)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, $11, $12)
        `;

                await client.query(insertQuery, [
                    dominio,
                    username,
                    senha,
                    email,
                    nome,
                    pacote || 'packagesitexpress',
                    bandwidth || 'unlimited',
                    quota || 'unlimited',
                    ip || '143.208.8.36',
                    id_projeto,
                    id_user,
                    uploadStatus.success
                ]);

                await client.query('COMMIT');

                return res.status(201).json({
                    success: true,
                    message: 'Hospedagem criada com sucesso',
                    data: {
                        dominio,
                        username,
                        senha,
                        email,
                        nome,
                        painel: `${DIRECTADMIN_CONFIG.host}`,
                        criado_em: new Date().toISOString(),
                        site_url: `http://${dominio}`,
                        upload: uploadStatus
                    }
                });

            } catch (dbError) {
                await client.query('ROLLBACK');
                console.error('Erro ao salvar no banco:', dbError);

                return res.status(201).json({
                    success: true,
                    message: 'Hospedagem criada com sucesso (erro ao salvar no banco)',
                    warning: 'Dados não foram salvos no banco de dados',
                    error: dbError,
                    data: {
                        dominio,
                        username,
                        senha,
                        email,
                        nome,
                        painel: `${DIRECTADMIN_CONFIG.host}`,
                        criado_em: new Date().toISOString(),
                        site_url: `http://${dominio}`,
                        upload: uploadStatus
                    }
                });
            }

        } else {
            console.error('❌ Erro na criação:', response.data);

            return res.status(400).json({
                success: false,
                message: 'Erro ao criar hospedagem no DirectAdmin',
                error: response.data.text || response.data.details || response.data.error || respostaString,
                debug: {
                    responseData: response.data,
                    responseType: typeof response.data,
                    status: response.status
                }
            });
        }

    } catch (error) {
        console.error('❌ Erro ao criar hospedagem:', error.message);
        console.error('❌ Stack:', error.stack);

        if (error.response) {
            console.error('❌ Response data:', error.response.data);
            console.error('❌ Response status:', error.response.status);

            return res.status(error.response.status).json({
                success: false,
                message: 'Erro na comunicação com DirectAdmin',
                error: error.response.data || error.message,
                details: {
                    status: error.response.status,
                    data: error.response.data
                }
            });
        }

        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({
                success: false,
                message: 'Não foi possível conectar ao servidor DirectAdmin'
            });
        }

        if (error.code === 'ETIMEDOUT') {
            return res.status(504).json({
                success: false,
                message: 'Timeout ao conectar com DirectAdmin'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Erro interno ao criar hospedagem',
            error: error.message
        });
    } finally {
        client.release();
    }
};

// Função para fazer upload do index.html via FTP ou API do DirectAdmin
async function uploadIndexHtml(username, senha, dominio, htmlContent) {
    try {
        // Método 1: Usando a API de File Manager do DirectAdmin
        const form = new FormData();

        // Criar um buffer com o conteúdo HTML
        const buffer = Buffer.from(htmlContent, 'utf-8');

        form.append('action', 'upload');
        form.append('path', '/domains/' + dominio + '/public_html');
        form.append('file', buffer, {
            filename: 'index.html',
            contentType: 'text/html'
        });

        const uploadResponse = await axios.post(
            `${DIRECTADMIN_CONFIG.host}/CMD_API_FILE_MANAGER`,
            form,
            {
                auth: {
                    username: username,
                    password: senha
                },
                headers: {
                    ...form.getHeaders()
                },
                timeout: 30000
            }
        );

        console.log('✅ Upload concluído:', uploadResponse.data);

        return {
            success: true,
            message: 'Arquivo index.html enviado com sucesso',
            path: '/public_html/index.html'
        };

    } catch (error) {
        console.error('❌ Erro no upload via API:', error.message);

        // Tentar método alternativo via FTP
        try {
            return await uploadViaFTP(username, senha, dominio, htmlContent);
        } catch (ftpError) {
            throw new Error(`Falha no upload: ${error.message}`);
        }
    }
}

// Método alternativo via FTP
async function uploadViaFTP(username, senha, dominio, htmlContent) {
    return new Promise((resolve, reject) => {
        const ftpClient = new Client();

        ftpClient.on('ready', () => {
            console.log('🔌 Conectado ao FTP');

            const remotePath = `/domains/${dominio}/public_html/index.html`;
            const tmpFile = `/tmp/${username}_${Date.now()}_index.html`;

            // Criar arquivo temporário
            fs.writeFileSync(tmpFile, htmlContent);

            ftpClient.put(tmpFile, remotePath, (err) => {
                // Remover arquivo temporário
                try {
                    fs.unlinkSync(tmpFile);
                } catch (unlinkErr) {
                    console.error('Erro ao remover arquivo temporário:', unlinkErr);
                }

                ftpClient.end();

                if (err) {
                    console.error('❌ Erro no upload FTP:', err);
                    reject(new Error(`Erro no FTP: ${err.message}`));
                } else {
                    console.log('✅ Upload via FTP concluído');
                    resolve({
                        success: true,
                        message: 'Arquivo enviado via FTP',
                        path: '/public_html/index.html'
                    });
                }
            });
        });

        ftpClient.on('error', (err) => {
            console.error('❌ Erro de conexão FTP:', err);
            reject(new Error(`Erro de conexão FTP: ${err.message}`));
        });

        // Conectar ao servidor FTP
        const ftpHost = DIRECTADMIN_CONFIG.host
            .replace('http://', '')
            .replace('https://', '')
            .split(':')[0];

        ftpClient.connect({
            host: ftpHost,
            user: username,
            password: senha,
            port: 21
        });
    });
}
/**
 * Lista todas as contas de hospedagem
 */
export const listar_hospedagens = async (req, res) => {
    try {
        const response = await axios.get(
            `${DIRECTADMIN_CONFIG.host}/CMD_API_SHOW_USERS`,
            {
                auth: {
                    username: DIRECTADMIN_CONFIG.username,
                    password: DIRECTADMIN_CONFIG.password
                },
                timeout: 10000
            }
        );

        return res.status(200).json({
            success: true,
            data: response.data
        });

    } catch (error) {
        console.error('Erro ao listar hospedagens:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro ao listar hospedagens',
            error: error.message
        });
    }
};

/**
 * Suspende uma conta de hospedagem
 */
export const suspender_hospedagem = async (req, res) => {
    try {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({
                success: false,
                message: 'Nome de usuário é obrigatório'
            });
        }

        const params = new URLSearchParams({
            select0: username,
            suspend: 'Suspend'
        });

        const response = await axios.post(
            `${DIRECTADMIN_CONFIG.host}/CMD_API_SELECT_USERS`,
            params.toString(),
            {
                auth: {
                    username: DIRECTADMIN_CONFIG.username,
                    password: DIRECTADMIN_CONFIG.password
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        return res.status(200).json({
            success: true,
            message: 'Hospedagem suspensa com sucesso',
            data: response.data
        });

    } catch (error) {
        console.error('Erro ao suspender hospedagem:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro ao suspender hospedagem',
            error: error.message
        });
    }
};

/**
 * Deleta uma conta de hospedagem
 */
export const deletar_hospedagem = async (req, res) => {
    try {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({
                success: false,
                message: 'Nome de usuário é obrigatório'
            });
        }

        const params = new URLSearchParams({
            confirmed: 'Confirm',
            delete: 'yes',
            select0: username
        });

        const response = await axios.post(
            `${DIRECTADMIN_CONFIG.host}/CMD_API_SELECT_USERS`,
            params.toString(),
            {
                auth: {
                    username: DIRECTADMIN_CONFIG.username,
                    password: DIRECTADMIN_CONFIG.password
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        return res.status(200).json({
            success: true,
            message: 'Hospedagem deletada com sucesso',
            data: response.data
        });

    } catch (error) {
        console.error('Erro ao deletar hospedagem:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro ao deletar hospedagem',
            error: error.message
        });
    }
};



export const consult_db = async (req, res) => {
    const client = await pool.connect();

    try {
        // Pega os parâmetros de query string (GET), body (POST) ou params (URL path)
        const id_user = req.query.id_user || req.body.id_user || req.params.id_user;
        const id_projeto = req.query.id_projeto || req.body.id_projeto || req.params.id_projeto;

        // Validação dos parâmetros
        if (!id_user || !id_projeto) {
            return res.status(400).json({
                qtd: false,
                erro: 'Parâmetros id_user e id_projeto são obrigatórios'
            });
        }

        const result = await client.query(
            `SELECT * FROM public.hospedagens 
             WHERE id_user = $1 AND id_projeto = $2 
             ORDER BY id DESC 
             LIMIT 1`,
            [id_user, id_projeto]
        );

        // Verifica se encontrou resultados antes de acessar
        if (result.rows.length > 0) {
            return res.json({
                url: result.rows[0].dominio,
                user: result.rows[0].username,
                pass: result.rows[0].senha,
                qtd: true
            });
        } else {
            return res.json({
                url: null,
                user: null,
                pass: null,
                qtd: false
            });
        }

    } catch (error) {
        console.error('Erro ao consultar banco:', error);
        return res.status(500).json({
            qtd: false,
            erro: 'Erro ao consultar banco de dados'
        });
    } finally {
        client.release();
    }
};


export const removerSubdominio = async (subdominio, username, senha) => {
    try {
        console.log('🗑️ Removendo subdomínio:', subdominio);

        // Preparar dados para a API do DirectAdmin
        const params = new URLSearchParams({
            action: 'delete',
            delete: 'yes',
            contents: "yes",
            select0: subdominio
        });

        // Fazer requisição para a API do DirectAdmin
        const response = await axios.post(
            `${DIRECTADMIN_CONFIG.host}/CMD_API_SUBDOMAIN`,
            params.toString(),
            {
                auth: {
                    username: username,
                    password: senha
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 15000
            }
        );

        console.log('📡 Resposta DirectAdmin:', response.data);

        // Verificar se foi removido com sucesso
        const respostaString = typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data);

        const sucesso = response.data.error === '0' ||
            response.data.error === 0 ||
            respostaString.includes('Subdomain Deleted') ||
            respostaString.includes('deleted') ||
            response.status === 200;

        if (sucesso) {
            console.log('✅ Subdomínio removido com sucesso');
            return {
                success: true,
                message: 'Subdomínio removido com sucesso',
                subdomain: subdominio
            };
        } else {
            console.error('❌ Erro ao remover subdomínio:', response.data);
            return {
                success: false,
                message: 'Erro ao remover subdomínio',
                error: response.data
            };
        }

    } catch (error) {
        console.error('❌ Erro ao remover subdomínio:', error.message);

        return {
            success: false,
            message: 'Erro ao comunicar com DirectAdmin',
            error: error.message
        };
    }
};
