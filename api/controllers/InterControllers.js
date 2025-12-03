import fs from "fs";
import https from "https";
import { console } from "inspector";
import pool from "../config/db.js";

const cert = fs.readFileSync("certificados/inter.crt");
const key = fs.readFileSync("certificados/inter.key");

const CLIENT_ID = process.env.INTER_CLIENT_ID;
const CLIENT_SECRET = process.env.INTER_CLIENT_SECRET;
const CONTA_CORRENTE = process.env.INTER_CONTA;
const CHAVE_PIX = process.env.INTER_CHAVE_PIX;

/* -----------------------------------------
   1) GERAR TOKEN OAUTH2
--------------------------------------------*/
async function gerarToken() {
    console.log("Gerando token Inter...");

    const data = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: "cob.write cob.read pix.cob.write pix.cob.read payloadlocation.write payloadlocation.read pix-webhook.write pix-webhook.read",
        grant_type: "client_credentials"
    });

    const options = {
        hostname: "cdpj.partners.bancointer.com.br",
        port: 443,
        path: "/oauth/v2/token",
        method: "POST",
        cert,
        key,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = "";
            res.on("data", (chunk) => body += chunk);
            res.on("end", () => {
                if (res.statusCode && res.statusCode >= 400) {
                    return reject(new Error(`Erro ao gerar token (Status: ${res.statusCode}): ${body}`));
                }
                try {
                    resolve(JSON.parse(body));
                } catch (err) {
                    reject(new Error(`Erro ao fazer parse do JSON (Token): ${err.message}. Body: ${body}`));
                }
            });
        });

        req.on("error", reject);
        req.write(data.toString());
        req.end();
    });
}


export const criarTokenAvuso = async () => {
    const tokenObj = await gerarToken();
    console.log(tokenObj);


    return tokenObj;
}

export const ReceberRetorno = async (req, res) => {
    try {
        console.log("📩 Webhook recebido do Banco Inter:");
        console.log(JSON.stringify(req.body, null, 2));

        // Sempre responder 200, senão o Inter tenta reenviar
        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error("Erro ao processar webhook:", error);
        return res.status(500).json({ error: "Erro interno" });
    }
};

export const cadastrarWebhookInter = async () => {
    console.log("🔗 Registrando webhook PIX...");

    const tokenData = await gerarToken();
    const token = tokenData.access_token;

    if (!token) {
        throw new Error("Token não gerado ao registrar webhook.");
    }

    const body = JSON.stringify({
        webhookUrl: "https://back.sitexpres.com.br/api/pix-inter/pagamento/retorno"
    });

    const options = {
        hostname: "cdpj.partners.bancointer.com.br",
        port: 443,
        path: `/pix/v2/webhook/${CHAVE_PIX}`,
        method: "PUT",
        cert,
        key,
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "x-conta-corrente": CONTA_CORRENTE,
            "Content-Length": Buffer.byteLength(body)
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = "";

            res.on("data", chunk => data += chunk);
            res.on("end", () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        });

        req.on("error", reject);
        req.write(body);
        req.end();
    });
}

export const listarWebhookInter = async () => {
    console.log("🔍 Listando webhook PIX cadastrado...");

    const tokenData = await gerarToken();
    console.log(tokenData)
    const token = tokenData.access_token;

    if (!token) {
        throw new Error("Token não gerado ao listar webhook.");
    }

    const options = {
        hostname: "cdpj.partners.bancointer.com.br",
        port: 443,
        path: `/pix/v2/webhook/${CHAVE_PIX}`,   // <-- sua chave Pix
        method: "GET",
        cert,
        key,
        headers: {
            "Authorization": `Bearer ${token}`,
            "x-conta-corrente": CONTA_CORRENTE
            // Não precisa de Content-Type nem Content-Length em GET
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = "";

            res.on("data", chunk => data += chunk);
            res.on("end", () => {
                // 200 → tem webhook cadastrado
                // 404 → não tem webhook para essa chave
                // outros códigos → erro de autenticação, etc.

                if (res.statusCode === 404) {
                    resolve({ webhookUrl: null, mensagem: "Nenhum webhook cadastrado para esta chave." });
                    return;
                }

                if (res.statusCode >= 400) {
                    reject(new Error(`Erro HTTP ${res.statusCode}: ${data || res.statusMessage}`));
                    return;
                }

                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    resolve(data); // em último caso retorna o texto puro
                }
            });
        });

        req.on("error", (err) => {
            reject(err);
        });

        req.end(); // GET não tem body
    });
};

export const consultarPix = async (req, res) => {
    try {
        const { txid } = req.body;
        console.log("==> Consultando cobrança PIX...", txid);

        if (!txid) {
            return res.status(400).json({ error: "TXID é obrigatório para consultar a cobrança." });
        }

        // 1. Gera token com escopo necessário
        const tokenData = await gerarToken();
        console.log(tokenData);
        console.log('Conta corrente:', CONTA_CORRENTE);
        const token = tokenData.access_token;

        if (!token) {
            return res.status(500).json({ error: "Token não gerado ao consultar PIX." });
        }

        // 2. Consulta no Banco Inter
        const options = {
            hostname: "cdpj.partners.bancointer.com.br",
            port: 443,
            path: `/pix/v2/cob/${encodeURIComponent(txid)}`,
            method: "GET",
            cert,
            key,
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "x-conta-corrente": CONTA_CORRENTE
            }
        };

        const respostaInter = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = "";
                res.on("data", chunk => data += chunk);
                res.on("end", () => {
                    if (res.statusCode === 404) {
                        resolve({ status: "NAO_ENCONTRADA" });
                        return;
                    }
                    if (res.statusCode >= 400) {
                        reject(new Error(`Erro HTTP ${res.statusCode}`));
                        return;
                    }
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve({ status: "ERRO_PARSE" });
                    }
                });
            });
            req.on("error", reject);
            req.end();
        });

        // 3. Se NÃO estiver CONCLUIDA → só retorna o status (não faz nada no banco)
        if (respostaInter.status !== "CONCLUIDA") {
            console.log(`Pix ${txid} ainda não pago. Status: ${respostaInter.status || 'não encontrado'}`);
            return res.json({
                pago: false,
                status: respostaInter.status || 'não encontrado',
                mensagem: "Aguardando pagamento..."
            });
        }

        // 4. AQUI O PAGAMENTO ESTÁ CONCLUÍDO NO INTER!
        console.log(`PAGAMENTO CONFIRMADO no Inter! Valor: ${respostaInter.valor?.original}`);

        // 5. Busca a transação no seu banco
        const result = await pool.query(
            `SELECT * FROM public.transactions WHERE payment_id = $1`,
            [txid]
        );

        if (result.rows.length === 0) {
            console.error("Transação não encontrada no banco com txid:", txid);
            return res.json({
                pago: true,
                status: "CONCLUIDA",
                erro: "Transação não encontrada no sistema"
            });
        }

        const transacao = result.rows[0];

        // 6. Se já estiver completed → evita duplicar
        if (transacao.status === 'completed') {
            console.log(`Pagamento ${txid} já foi processado antes.`);
            return res.json({
                pago: true,
                status: "CONCLUIDA",
                jaProcessado: true,
                mensagem: "Pagamento já creditado!",
                redirect: `https://sitexpres.com.br/sucesso?order=${txid}`
            });
        }

        // 7. Se ainda estiver pending → PROCESSA!
        if (transacao.status === 'pending') {
            console.log(`Adicionando ${transacao.credits} créditos ao usuário ${transacao.user_id}`);

            // Adiciona créditos
            await pool.query(
                `UPDATE public.users SET credits = credits + $1 WHERE id = $2`,
                [transacao.credits, transacao.user_id]
            );

            // Atualiza status da transação
            await pool.query(
                `UPDATE public.transactions SET status = 'completed', updated_at = NOW() WHERE payment_id = $1`,
                [txid]
            );

            console.log(`Créditos adicionados e transação ${txid} marcada como completed!`);

            return res.json({
                pago: true,
                status: "CONCLUIDA",
                mensagem: "Pagamento processado com sucesso!",
                creditsAdicionados: transacao.credits,
                redirect: `https://sitexpres.com.br/sucesso?order=${txid}`
            });
        }

        // Caso raro (ex: cancelled)
        return res.json({
            pago: true,
            status: "CONCLUIDA",
            mensagem: `Transação com status ${transacao.status} (não processada)`
        });
    } catch (error) {
        console.error("Erro ao consultar PIX:", error);
        return res.status(500).json({
            pago: false,
            status: "ERRO",
            mensagem: "Erro interno ao consultar PIX",
            erro: error.message
        });
    }
};

/* -----------------------------------------
    2) CRIAR LOCATION DA RECORRÊNCIA (locrec)
--------------------------------------------*/
async function criarLocation(bearerToken) {

    console.log("Bearer Token:", bearerToken);
    const options = {
        hostname: "cdpj.partners.bancointer.com.br",
        port: 443,
        path: "/pix/v2/locrec",
        method: "POST",
        cert,
        key,
        headers: {
            "Authorization": "Bearer " + bearerToken,
            "x-conta-corrente": process.env.INTER_CONTA,
            "Content-Type": "application/json"
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = "";
            res.on("data", chunk => body += chunk);
            res.on("end", () => {
                if (res.statusCode && res.statusCode >= 400) {
                    return reject(new Error(`Erro ao criar location (Status: ${res.statusCode}): ${body}`));
                }
                try {
                    resolve(JSON.parse(body));
                } catch (err) {
                    reject(new Error(`Erro ao fazer parse do JSON (Location): ${err.message}. Body: ${body}`));
                }
            });
        });

        req.on("error", reject);
        req.end();
    });
}

/* -----------------------------------------
    3) CRIAR COBRANÇA COM VENCIMENTO
--------------------------------------------*/
async function criarCobrancaPix(bearerToken, locationId, txid, dados) {
    const body = {
        calendario: {
            dataDeVencimento: dados.dataVencimento,
            validadeAposVencimento: 30
        },
        loc: { id: locationId },
        devedor: {
            cpf: dados.cpf,
            nome: dados.nome
        },
        valor: {
            original: dados.valor
        },
        chave: process.env.INTER_CHAVE_PIX,
        solicitacaoPagador: dados.descricao || "Pagamento recorrente"
    };

    const options = {
        hostname: "cdpj.partners.bancointer.com.br",
        port: 443,
        path: `/pix/v2/cobv/${txid}`,
        method: "PUT",
        cert,
        key,
        headers: {
            "Authorization": "Bearer " + bearerToken,
            "x-conta-corrente": process.env.INTER_CONTA,
            "Content-Type": "application/json"
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = "";
            res.on("data", (chunk) => body += chunk);
            res.on("end", () => {
                if (res.statusCode && res.statusCode >= 400) {
                    return reject(new Error(`Erro ao criar cobrança (Status: ${res.statusCode}): ${body}`));
                }
                try {
                    resolve(JSON.parse(body));
                } catch (err) {
                    reject(new Error(`Erro ao fazer parse do JSON (Cobrança): ${err.message}. Body: ${body}`));
                }
            });
        });

        req.on("error", reject);
        req.write(JSON.stringify(body));
        req.end();
    });
}

/* -----------------------------------------
    4) CONTROLLER — ROTA /pagamento/criar
--------------------------------------------*/
export const criarCobranca = async (req, res) => {
    try {
        const { value, cpf, nome, dataVencimento, descricao, qtd_creditos, id_user } = req.body;

        console.log('Valor recebido:', value);

        // Mapeia 'value' para 'valor' para manter compatibilidade com o resto do código
        const valor = value;

        if (!valor || !cpf || !nome || !dataVencimento || !qtd_creditos) {
            return res.status(400).json({
                erro: "Campos obrigatórios: value, cpf, nome, dataVencimento, qtd_creditos"
            });
        }



        const valorNumerico = parseFloat(valor);
        const creditos = parseInt(qtd_creditos);
        const precoPorCredito = 0.85;
        const valorPlanoEspecial = 29.90;
        const precoCreditoPlano = 0.60; // Apenas informativo, a validação é pelo valor total do plano

        // Validação do valor
        let valorValido = false;

        // 1. Verifica se é o plano especial de 29.90
        if (Math.abs(valorNumerico - valorPlanoEspecial) < 0.01) {
            valorValido = true;
        }
        // 2. Verifica se o valor corresponde à quantidade de créditos * 0.85
        else {
            const valorEsperado = creditos * precoPorCredito;
            if (Math.abs(valorNumerico - valorEsperado) < 0.01) {
                valorValido = true;
            }
        }

        if (!valorValido) {
            return res.status(400).json({
                erro: "Valor incorreto. O valor deve ser 29.90 (Plano) ou corresponder a qtd_creditos * 0.85."
            });
        }

        // 1) TOKEN
        const tokenObj = await gerarToken();
        const accessToken = tokenObj.access_token;

        // console.log("Token gerado:", accessToken);

        // 2) Location
        const locationObj = await criarLocation(accessToken);

        // 3) Gerar TXID único (26-35 caracteres, alfanumérico)
        // Ex: "Recorrente" (10) + Timestamp (13) + Random (7) = 30 chars
        const txid = "Recorrente" + Date.now() + Math.random().toString(36).substring(2, 9);

        // 4) Criar cobrança
        const cobranca = await criarCobrancaPix(
            accessToken,
            locationObj.id,
            txid,
            { valor, cpf, nome, dataVencimento, descricao }
        );

        return res.json({
            status: "OK",
            txid,
            location: locationObj,
            cobranca
        });

    } catch (err) {
        console.error("ERRO PIX INTER:", err);
        return res.status(500).json({
            erro: true,
            message: err.message || err.toString()
        });
    }
};

/* -----------------------------------------
    5) CONTROLLER — ROTA /pagamento/unico
--------------------------------------------*/
export const criarCobrancaUnica = async (req, res) => {
    const {
        value,
        nome,
        cpf,
        descricao,
        chave,
        expiracao,
        qtd_creditos
    } = req.body;

    // Mapeia 'value' para 'valor'
    const valor = value;

    if (!valor || !qtd_creditos) {
        return res.status(400).json({
            erro: "Campos obrigatórios: value, qtd_creditos"
        });
    }

    const valorNumerico = parseFloat(valor);
    const creditos = parseInt(qtd_creditos);
    const precoPorCredito = 0.85;
    const valorPlanoEspecial = 29.90;

    // Validação do valor
    let valorValido = false;

    // 1. Verifica se é o plano especial de 29.90
    if (Math.abs(valorNumerico - valorPlanoEspecial) < 0.01) {
        valorValido = true;
    }
    // 2. Verifica se o valor corresponde à quantidade de créditos * 0.85
    else {
        const valorEsperado = creditos * precoPorCredito;
        if (Math.abs(valorNumerico - valorEsperado) < 0.01) {
            valorValido = true;
        }
    }

    if (!valorValido) {
        return res.status(400).json({
            erro: "Valor incorreto. O valor deve ser 29.90 (Plano) ou corresponder a qtd_creditos * 0.85."
        });
    }

    // Gerar TXID compatível: 26 a 35 caracteres, apenas alfanumérico
    // Ex: "SITEXPRES" (9) + Timestamp (13) + Random (8) = 30 chars
    const txid = "SITEXPRES" + Date.now() + Math.random().toString(36).substring(2, 10);

    const payload = {
        calendario: {
            expiracao: expiracao ?? 3600 // 1 hora
        },
        devedor: {
            nome: nome,
            cpf: cpf
        },
        valor: {
            original: valor
        },
        chave: process.env.INTER_CHAVE_PIX,
        solicitacaoPagador: descricao ?? "Pagamento Serviço Sitexpress"
    };

    const dataString = JSON.stringify(payload);

    const tokenObj = await gerarToken();
    // console.log(tokenObj)
    const accessToken = tokenObj.access_token;


    //---------------   
    //Salvado Transacao no banco de dados 

    var ID_user = req.body.userid || "00";
    const transacao = await criarTransacao({
        ID_user,
        txid,
        valor,
        qtd_creditos,
        nome,
        cpf,
        descricao,
        chave,
        expiracao,
        status: "pending"
    });

    console.log("Transacao salva no banco de dados:", transacao);
    //---------------

    const options = {
        hostname: "cdpj.partners.bancointer.com.br", // ex: cdpj.partners.bancointer.com.br
        port: 443,
        path: `/pix/v2/cob/${txid}`,
        method: "PUT",
        cert: cert,
        key: key,
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(dataString),
            "x-conta-corrente": process.env.INTER_CONTA
        }
    };

    const request = https.request(options, (response) => {
        let data = "";

        response.on("data", (chunk) => {
            data += chunk;
        });

        response.on("end", () => {
            if (response.statusCode >= 200 && response.statusCode < 300) {
                return res.json({
                    sucesso: true,
                    txid,
                    resposta: JSON.parse(data)
                });
            } else {
                return res.status(400).json({
                    erro: "Erro ao criar cobrança",
                    status: response.statusCode,
                    detalhes: data
                });
            }
        });
    });

    request.on("error", (e) => {
        console.error("Erro PIX:", e);
        res.status(500).json({ erro: e.message });
    });

    request.write(dataString);
    request.end();
};


// Função para criar transação no banco de dados
const criarTransacao = async ({
    txid,
    valor,
    qtd_creditos,
    nome,
    cpf,
    descricao,
    chave,
    expiracao,
    status,
    ID_user
}) => {
    try {
        const result = await pool.query(
            `
            INSERT INTO public.transactions (
                user_id,
                type,
                status,
                description,
                credits,
                monetary_value,
                payment_method,
                payment_id,
                url_payment,
                value
            ) VALUES (
                $1,
                'purchase_credits',
                $2,
                $3,
                $4,
                $5,
                'PIX',
                $6,
                '',   -- PIX ainda nao tem URL, pode preencher depois
                $7
            )
            RETURNING *
            `,
            [
                ID_user,                        // $1
                status,                         // $2
                descricao || "Compra PIX",      // $3
                qtd_creditos,                   // $4
                valor,                          // $5 (monetary_value)
                txid,                           // $6 (payment_id)
                valor                           // $7 (value)
            ]
        );

        return result.rows[0];

    } catch (err) {
        console.error("Erro ao criar transação PIX:", err);
        throw err;
    }
};



