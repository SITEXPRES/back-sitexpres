import axios from 'axios';
import crypto from 'crypto';
import pool from '../config/db.js';

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
    let username = gerarUsername(nomeBase);
    let tentativas = 0;
    const maxTentativas = 10;

    while (await usernameExiste(username) && tentativas < maxTentativas) {
        const sufixo = Math.floor(Math.random() * 999);
        username = `${gerarUsername(nomeBase).substring(0, 13)}${sufixo}`;
        tentativas++;
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
        const username = await gerarUsernameUnico(nome);
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
            notify: 'yes'
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

            // Salvar informações no banco de dados PostgreSQL
            await client.query('BEGIN');

            try {
                const insertQuery = `
          INSERT INTO hospedagens 
          (dominio, username, senha, email, nome, pacote, bandwidth, quota, ip, criado_em,id_projeto,id_user)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(),$10,$11)
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
                    id_user

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
                        criado_em: new Date().toISOString()
                    }
                });

            } catch (dbError) {
                await client.query('ROLLBACK');
                console.error('Erro ao salvar no banco:', dbError);

                return res.status(201).json({
                    success: true,
                    message: 'Hospedagem criada com sucesso (erro ao salvar no banco)',
                    warning: 'Dados não foram salvos no banco de dados',
                    data: {
                        dominio,
                        username,
                        senha,
                        email,
                        nome,
                        painel: `${DIRECTADMIN_CONFIG.host}`,
                        criado_em: new Date().toISOString()
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