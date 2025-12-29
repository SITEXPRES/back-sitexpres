import https from 'https';
import http from 'http';
import { URL } from 'url';
import pool from "../config/db.js";

// Configurações da API ResellerClub
const RESELLER_CONFIG = {
    baseURL: process.env.RESELLER_BASE_URL || 'https://test.httpapi.com/api',
    authUserId: process.env.RESELLER_AUTH_USER_ID,
    apiKey: process.env.RESELLER_API_KEY
};

/**
 * Função auxiliar para fazer requisições HTTP/HTTPS
 */
const makeRequest = (url, method = 'GET', postData = null) => {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'User-Agent': 'ResellerClub-API-Client/1.0',
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 30000
        };

        if (postData) {
            options.headers['Content-Length'] = Buffer.byteLength(postData);
        }

        const req = client.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({ status: res.statusCode, data: jsonData });
                } catch (e) {
                    // Se não for JSON, retorna o texto puro
                    if (data.includes('Cloudflare') || data.includes('blocked')) {
                        reject(new Error('CLOUDFLARE_BLOCK'));
                    } else {
                        resolve({ status: res.statusCode, data: data });
                    }
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (postData) {
            req.write(postData);
        }

        req.end();
    });
};

/**
 * Verifica disponibilidade de domínios
 */
export const check_domain_availability = async (req, res) => {
    try {
        const { domainNames } = req.body;

        if (!Array.isArray(domainNames) || domainNames.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Lista de domínios é obrigatória'
            });
        }

        // pega o primeiro domínio (API não aceita vários completos sem tlds)
        const domainFull = domainNames[0].toLowerCase().trim();

        // separa nome e tld
        const parts = domainFull.split('.');
        const tld = parts.pop();
        const domainName = parts.join('.');

        const url =
            `${RESELLER_CONFIG.baseURL}/domains/available.json` +
            `?auth-userid=${RESELLER_CONFIG.authUserId}` +
            `&api-key=${RESELLER_CONFIG.apiKey}` +
            `&domain-name=${encodeURIComponent(domainName)}` +
            `&tlds=${encodeURIComponent(tld)}`;

        const response = await makeRequest(url);

        return res.status(200).json({
            success: true,
            data: response.data
        });

    } catch (error) {
        console.error('Erro ao verificar disponibilidade:', error.message);

        if (error.message === 'CLOUDFLARE_BLOCK') {
            return res.status(403).json({
                success: false,
                message: 'Bloqueado pelo Cloudflare. Configure o IP no painel: Settings > API > IP Whitelist',
                details: 'Adicione o IP do servidor no painel da ResellerClub'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Erro ao verificar disponibilidade',
            error: error.message
        });
    }
};


//Função para criar Customer e depois registrar o domínio.
export const function_master_creat = async (req, res) => {

    var data_customer = await create_customer_reseller(req, res);
    var data_domain = await create_domain_reseller(req, res);

    return res.status(200).json({
        success: true,
        message: 'Cliente e domínio criados com sucesso',
        data: {
            customer: data_customer,
            domain: data_domain
        }
    });
};


/**
 * Cria um novo cliente na ResellerClub
 */
export const create_customer_reseller = async (req, res) => {
    try {
        const {
            email,
            password,
            name,
            company,
            addressLine1,
            city,
            state,
            country,
            zipCode,
            phoneCountryCode,
            phone,
            langPref = 'pt'
        } = req.body;

        if (!email || !password || !name || !country || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Campos obrigatórios faltando (email, password, name, country, phone)'
            });
        }

        const url = `${RESELLER_CONFIG.baseURL}/customers/signup.json?auth-userid=${RESELLER_CONFIG.authUserId}&api-key=${RESELLER_CONFIG.apiKey}&username=${encodeURIComponent(email)}&passwd=${encodeURIComponent(password)}&name=${encodeURIComponent(name)}&company=${encodeURIComponent(company || name)}&address-line-1=${encodeURIComponent(addressLine1 || '')}&city=${encodeURIComponent(city || '')}&state=${encodeURIComponent(state || '')}&country=${country}&zipcode=${encodeURIComponent(zipCode || '')}&phone-cc=${phoneCountryCode || '55'}&phone=${phone}&lang-pref=${langPref}`;

        const response = await makeRequest(url, 'POST');

        return res.status(200).json({
            success: true,
            message: 'Cliente criado com sucesso',
            data: response.data
        });

    } catch (error) {
        console.error('Erro ao criar cliente:', error.message);

        if (error.message === 'CLOUDFLARE_BLOCK') {
            return res.status(403).json({
                success: false,
                message: 'Bloqueado pelo Cloudflare. Configure o IP no painel da ResellerClub'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Erro ao criar cliente',
            error: error.message
        });
    }
};


export const get_default_contact = async (customerId) => {
    // Busca os contatos do tipo 'Contact' vinculados a esse cliente
    const url = `${RESELLER_CONFIG.baseURL}/contacts/search.json?auth-userid=${RESELLER_CONFIG.authUserId}&api-key=${RESELLER_CONFIG.apiKey}&customer-id=${customerId}&type=Contact`;

    const response = await makeRequest(url, 'GET');

    // A ResellerClub retorna um objeto onde o campo 'result' contém a lista
    if (response.data && response.data.result && response.data.result.length > 0) {
        // Retorna o entity.entityid do primeiro contato encontrado
        return response.data.result[0]['entity.entityid'];
    }
    return null;
};
/**
 * Registra/cria um novo domínio
 */

export const create_domain_reseller = async (req, res) => {
    try {
        /* ===============================
           1️⃣ NORMALIZAÇÃO DO BODY
        =============================== */
        const body = req.body || {};

        const domainName = body.domainName;
        const years = body.years || 1;

        // Aceita customerId OU customer-id
        const customerId = body.customerId || body['customer-id'];

        const nameServers = body.nameServers;
        const invoiceOption = body.invoiceOption || 'NoInvoice';
        const protectPrivacy = body.protectPrivacy || false;

        if (!domainName || !customerId) {
            return res.status(400).json({
                success: false,
                message: 'domainName e customerId são obrigatórios',
                recebido: body
            });
        }

        /* ===============================
           2️⃣ BUSCA OU CRIAÇÃO DO CONTATO
        =============================== */
        let contactId = await get_default_contact(customerId);

        if (!contactId) {
            console.log('Contato não encontrado. Criando novo contato...');

            const contactResponse = await create_contact_reseller(customerId, body);

            console.log('Contato criado:', contactResponse);

            if (!contactResponse || contactResponse.status === 'ERROR') {
                return res.status(400).json({
                    success: false,
                    message: 'Falha ao criar contato obrigatório',
                    details: contactResponse
                });
            }

            contactId = contactResponse.entityid || contactResponse;

            if (!contactId) {
                return res.status(400).json({
                    success: false,
                    message: 'Contato criado, mas ID não retornado pela API',
                    details: contactResponse
                });
            }
        }

        /* ===============================
           3️⃣ NAMESERVERS
        =============================== */
        const nsList =
            Array.isArray(nameServers) && nameServers.length > 0
                ? nameServers
                : ['dns1.registrar-servers.com', 'dns2.registrar-servers.com'];

        /* ===============================
           4️⃣ MONTA URL DE REGISTRO
        =============================== */
        let url =
            `${RESELLER_CONFIG.baseURL}/domains/register.json` +
            `?auth-userid=${RESELLER_CONFIG.authUserId}` +
            `&api-key=${RESELLER_CONFIG.apiKey}` +
            `&domain-name=${encodeURIComponent(domainName)}` +
            `&years=${years}` +
            `&customer-id=${customerId}` +
            `&reg-contact-id=${contactId}` +
            `&admin-contact-id=${contactId}` +
            `&tech-contact-id=${contactId}` +
            `&billing-contact-id=${contactId}` +
            `&invoice-option=${invoiceOption}` +
            `&protect-privacy=${protectPrivacy}`;

        nsList.forEach(ns => {
            url += `&ns=${encodeURIComponent(ns)}`;
        });

        /* ===============================
           5️⃣ CHAMADA À API
        =============================== */
        const response = await makeRequest(url, 'POST');

        if (
            response?.data?.status === 'ERROR' ||
            response?.data?.status === 'error'
        ) {
            return res.status(400).json({
                success: false,
                message: 'Erro na API do Revendedor',
                details: response.data
            });
        }

        /* ===============================
           6️⃣ SUCESSO
        =============================== */
        return res.status(200).json({
            success: true,
            message: 'Domínio registrado com sucesso',
            data: response.data
        });

    } catch (error) {
        console.error('Erro fatal no registro de domínio:', error);

        return res.status(500).json({
            success: false,
            message: 'Erro interno ao registrar domínio',
            error: error.message
        });
    }
};



export const create_contact_reseller_controller = async (req, res) => {
    const { customerId } = req.body;
    const result = await create_contact_reseller(customerId, req.body);
    return res.json(result);
};



/**
 * Cria um novo contato
 */
export const create_contact_reseller = async (customerId, userData) => {
    const {
        name,
        company,
        email,
        addressLine1,
        city,
        state,
        country,
        zipCode,
        phoneCountryCode,
        phone
    } = userData;

    if (!customerId) {
        throw new Error('customerId não informado para criação de contato');
    }

    // Normalizações exigidas pela ResellerClub
    const cityNormalized = city
        ? city.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        : 'NA';

    const telno = `${phoneCountryCode || '55'}${phone}`;

    const url =
        `${RESELLER_CONFIG.baseURL}/contacts/add.json` +
        `?auth-userid=${RESELLER_CONFIG.authUserId}` +
        `&api-key=${RESELLER_CONFIG.apiKey}` +
        `&customer-id=${customerId}` +
        `&name=${encodeURIComponent(name)}` +
        `&company=${encodeURIComponent(company || name)}` +
        `&emailaddr=${encodeURIComponent(email)}` +
        `&address-line-1=${encodeURIComponent(addressLine1)}` +
        `&city=${encodeURIComponent(cityNormalized)}` +
        `&state=${encodeURIComponent(state || 'NA')}` +
        `&country=${country}` +
        `&zipcode=${encodeURIComponent(zipCode)}` +
        `&telno=${encodeURIComponent(telno)}` +
        `&type=Contact`;

    const response = await makeRequest(url, 'POST');

    return response.data;
};


/**
 * Obtém detalhes de um domínio
 */
export const get_domain_details = async (req, res) => {
    try {
        const { domainName } = req.params;

        if (!domainName) {
            return res.status(400).json({
                success: false,
                message: 'Nome do domínio é obrigatório'
            });
        }

        const url = `${RESELLER_CONFIG.baseURL}/domains/details.json?auth-userid=${RESELLER_CONFIG.authUserId}&api-key=${RESELLER_CONFIG.apiKey}&domain-name=${encodeURIComponent(domainName)}&options=All`;

        const response = await makeRequest(url);

        return res.status(200).json({
            success: true,
            data: response.data
        });

    } catch (error) {
        console.error('Erro ao obter detalhes:', error.message);

        if (error.message === 'CLOUDFLARE_BLOCK') {
            return res.status(403).json({
                success: false,
                message: 'Bloqueado pelo Cloudflare. Configure o IP no painel da ResellerClub'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Erro ao obter detalhes do domínio',
            error: error.message
        });
    }
};





/**
 * Renova um domínio
 */
export const renew_domain_reseller = async (req, res) => {
    try {
        const { domainName, years = 1, invoiceOption = 'NoInvoice' } = req.body;

        if (!domainName) {
            return res.status(400).json({
                success: false,
                message: 'Nome do domínio é obrigatório'
            });
        }

        const expDate = Math.floor(Date.now() / 1000);
        const url = `${RESELLER_CONFIG.baseURL}/domains/renew.json?auth-userid=${RESELLER_CONFIG.authUserId}&api-key=${RESELLER_CONFIG.apiKey}&order-id=${encodeURIComponent(domainName)}&years=${years}&exp-date=${expDate}&invoice-option=${invoiceOption}`;

        const response = await makeRequest(url, 'POST');

        return res.status(200).json({
            success: true,
            message: 'Domínio renovado com sucesso',
            data: response.data
        });

    } catch (error) {
        console.error('Erro ao renovar domínio:', error.message);

        if (error.message === 'CLOUDFLARE_BLOCK') {
            return res.status(403).json({
                success: false,
                message: 'Bloqueado pelo Cloudflare'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Erro ao renovar domínio',
            error: error.message
        });
    }
};

/**
 * Modifica nameservers de um domínio
 */
export const modify_nameservers = async (req, res) => {
    try {
        const { domainName, nameServers } = req.body;

        if (!domainName || !nameServers || nameServers.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'domainName e nameServers são obrigatórios'
            });
        }

        let url = `${RESELLER_CONFIG.baseURL}/domains/modify-ns.json?auth-userid=${RESELLER_CONFIG.authUserId}&api-key=${RESELLER_CONFIG.apiKey}&order-id=${encodeURIComponent(domainName)}`;

        nameServers.forEach((ns, index) => {
            url += `&ns${index + 1}=${encodeURIComponent(ns)}`;
        });

        const response = await makeRequest(url, 'POST');

        return res.status(200).json({
            success: true,
            message: 'Nameservers modificados com sucesso',
            data: response.data
        });

    } catch (error) {
        console.error('Erro ao modificar nameservers:', error.message);

        if (error.message === 'CLOUDFLARE_BLOCK') {
            return res.status(403).json({
                success: false,
                message: 'Bloqueado pelo Cloudflare'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Erro ao modificar nameservers',
            error: error.message
        });
    }
};

export const listar_extensao = async (req, res) => {
    try {
        const query = 'SELECT * FROM public.domain_extensions';
        const result = await pool.query(query);

        // Retorna status 200 explicitamente
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erro ao listar extensões:', error);

        // Retorna um erro amigável para o front-end
        return res.status(500).json({
            error: 'Erro interno ao buscar extensões de domínio.'
        });
    }
};
