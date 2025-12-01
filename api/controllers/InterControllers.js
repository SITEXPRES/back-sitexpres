import fs from "fs";
import https from "https";

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

    const data = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: "payloadlocationrec.write payloadlocationrec.read payloadlocation.write payloadlocation.read cob.write cob.read pix.cob.write pix.cob.read pix.cobv.write pix.cobv.read",
 

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
        const { valor, cpf, nome, dataVencimento, descricao } = req.body;

        if (!valor || !cpf || !nome || !dataVencimento) {
            return res.status(400).json({
                erro: "Campos obrigatórios: valor, cpf, nome, dataVencimento"
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
        valor,
        nome,
        cpf,
        descricao,
        chave,
        expiracao
    } = req.body;

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
    const accessToken = tokenObj.access_token;

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
