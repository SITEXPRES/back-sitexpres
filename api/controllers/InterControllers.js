import fs from "fs";
import https from "https";
import { console } from "inspector";
import pool from "../config/db.js";
import { gerandonotafiscal, gerarNotaNacional } from "../services/notafiscalService.js";
import { createCustomerReseller_funcao, create_domain_reseller_funcao } from "./resellerController.js";
import { sendMail } from "../services/emailService.js";
import { buildStyledEmail } from "../services/emailTemplateBuilder.js";

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
                    console.error(`❌ Erro Inter API (Status ${res.statusCode}):`, body);
                    return reject(new Error(`Erro ao gerar token (Status: ${res.statusCode}). Verifique se o CLIENT_ID, SECRET e Certificados estão corretos.`));
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

        // Alerta de erro para o administrador
        try {
            await sendMail(
                "contato@sitexpres.com",
                "🚨 ERRO no Webhook de Pagamento (Inter PIX)",
                `<p>Ocorreu um erro inesperado ao receber o webhook do Banco Inter.</p>
                 <p><b>Detalhes do erro:</b> ${error.message}</p>
                 <p><b>Payload recebido:</b> <pre>${JSON.stringify(req.body, null, 2)}</pre></p>`
            );
        } catch (mailErr) {
            console.error("Erro ao enviar alerta de e-mail Webhook:", mailErr);
        }

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
            
            // VERIFICA SE O USUÁRIO JÁ É PREMIUM. SE NÃO FOR, SALVA OS CRÉDITOS ATUAIS COMO FREE CREDITS
            const checkPlan = await pool.query(
                `SELECT plan FROM public.user_subscriptions WHERE user_id = $1 AND is_active = true`,
                [transacao.user_id]
            );
            
            const isPremium = checkPlan.rows.length > 0 && checkPlan.rows[0].plan === 'premium';
            
            if (!isPremium) {
                await pool.query(
                    `UPDATE public.users SET free_credits = credits WHERE id = $1`,
                    [transacao.user_id]
                );
                console.log(`Créditos free salvos (backup) para o usuário ${transacao.user_id}`);
            }

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

            //Consultar dados do usuário para nota fiscal
            const result = await pool.query(
                `SELECT * FROM public.users WHERE id = $1`,
                [transacao.user_id]
            );

            // Se tiver outra assinatura ativa, define como false
            await pool.query(
                `UPDATE public.user_subscriptions SET is_active = false WHERE user_id = $1 AND is_active = true`,
                [transacao.user_id]
            );

            //Colocando usuário como premium
            await pool.query(
                `INSERT INTO public.user_subscriptions (user_id, plan, is_active) 
         VALUES ($1, 'premium', true)`,
                [transacao.user_id]
            );

            // ENVIA NOTA FISCAL
            var notaFiscal = await gerarNotaNacional({
                valor_servico: transacao.monetary_value,
                cnpj_cpf: result.rows[0].cnpj_cpf,
                razao_social: result.rows[0].razao_social || result.rows[0].name,
                endereco: result.rows[0].endereco,
                bairro: result.rows[0].bairro,
                cod_municipio: result.rows[0].cod_municipio,
                uf: result.rows[0].uf,
                cep: result.rows[0].cep,
                telefone: result.rows[0].telefone,
                email: result.rows[0].email,
                descricao: `Pagamento via Pix - Transação: ${txid}`
            });

            console.log("Retorno NF Nacional:", notaFiscal);

            let linkNF = null;
            let chaveAcesso = null;

            if (notaFiscal.sucesso) {
                linkNF = notaFiscal.linkConsulta;
                chaveAcesso = notaFiscal.chaveAcesso;
                
                // Enviar email para o cliente com a nota fiscal
                try {
                    const isForeign = (result.rows[0].uf === "EX" || result.rows[0].cep === "00000000");
                    let clientTheme = {
                        title: "Sua Nota Fiscal foi gerada! 📄",
                        subject: "📄 Sua Nota Fiscal foi gerada!",
                        text1: "Sua Nota Fiscal de Serviços Eletrônica (NFS-e) foi emitida com sucesso!",
                        text2: "Você pode consultar e baixar o PDF da sua nota no portal oficial do governo.<br>Para isso, <b>copie a Chave de Acesso abaixo</b> e cole na seguinte página:",
                        btn: "Consultar NFS-e"
                    };
                    if (isForeign) {
                        clientTheme = {
                            title: "Your Invoice has been generated! 📄",
                            subject: "📄 Your Invoice has been generated!",
                            text1: "Your Commercial Invoice (NFS-e) has been successfully issued!",
                            text2: "You can view and download the PDF of your invoice on the official government portal.<br>To do so, <b>copy the Access Key below</b> and paste it on the following page:",
                            btn: "View Invoice"
                        };
                    }

                    const clientHtml = buildStyledEmail(
                        clientTheme.title,
                        result.rows[0].name,
                        `<p class="email-text">${clientTheme.text1}</p>
                         <p class="email-text">${clientTheme.text2}</p>
                         <div class="chave-box">${chaveAcesso}</div>
                         <p class="email-text"><a href="${linkNF}">${linkNF}</a></p>`,
                        clientTheme.btn,
                        linkNF
                    );

                    await sendMail(result.rows[0].email, clientTheme.subject, clientHtml);
                } catch (emailErr) {
                    console.error("Erro ao enviar email da nota para o cliente:", emailErr);
                }

            } else {
                console.error("Falha ao gerar NF Nacional:", notaFiscal.mensagem, notaFiscal.erro);
                // Notificar admin sobre falha da nota
                try {
                    const errorMsg = typeof notaFiscal.erro === 'object' ? JSON.stringify(notaFiscal.erro) : notaFiscal.erro;
                    await sendMail(
                        "contato@sitexpres.com",
                        "🚨 ERRO ao Gerar Nota Fiscal Nacional (Inter PIX)",
                        `<p>Ocorreu um erro ao gerar a Nota Fiscal Nacional para a transação <b>${txid}</b> (Usuário: ${result.rows[0].email}).</p>
                         <p><b>Mensagem:</b> ${notaFiscal.mensagem}</p>
                         <p><b>Detalhes do Erro:</b> ${errorMsg}</p>`
                    );
                } catch (emailErr) {
                    console.error("Erro ao notificar admin sobre falha de NF:", emailErr);
                }
            }

            
            if (notaFiscal.sucesso) {
                try {
                    const isForeign = (result.rows[0].uf === "EX" || result.rows[0].cep === "00000000");
                    let subjectAdmin = `✅ Novo Pix e Nota Fiscal Gerada - ${result.rows[0].name}`;
                    let bodyAdmin = `O Pix de ${result.rows[0].name} foi confirmado!<br>
                        Valor: R$ ${valorPagamento}<br>
                        A nota fiscal foi emitida com sucesso!<br>
                        Chave de Acesso: <b>${chaveAcesso}</b><br>
                        Link de Consulta: <a href="${linkNF}">${linkNF}</a>`;
                        
                    if (isForeign) {
                        subjectAdmin = `✅ [GRINGO] Novo Pix Exportação - ${result.rows[0].name}`;
                        bodyAdmin = `<b>⚠️ PAGAMENTO DE CLIENTE GRINGO (EXTERIOR)</b><br><br>` + bodyAdmin;
                    }
                    
                    await sendMail("contato@sitexpres.com", subjectAdmin, bodyAdmin);
                } catch (emailErr) {}
            }
            console.log("Link da Nota Fiscal salva:", linkNF);

            // Salva o link/chave no banco
            await pool.query(
                `UPDATE public.transactions SET nota_fiscal = $1 WHERE payment_id = $2`,
                [linkNF || chaveAcesso || 'ERRO_EMISSAO', txid]
            );

            console.log(`Créditos adicionados e transação ${txid} marcada como completed!`);

            // -----------------------------------------------------------------
            // NOVA LÓGICA: REGISTRAR PRÓXIMO CICLO (Fatura Pendente)
            // -----------------------------------------------------------------
            try {
                const valorAtual = parseFloat(transacao.monetary_value);
                const isDev = process.env.DEV_MODE === 'true';

                // Registrar próximo ciclo apenas se for valor cheio (>= 29.90) ou se for DEV
                if (valorAtual >= 29.90 || isDev) {
                    console.log(`Registrando próximo ciclo para valor: ${valorAtual} (Dev: ${isDev})`);
                    
                    const due_date = new Date();
                    due_date.setMonth(due_date.getMonth() + 1);

                    const txidNext = `PENDING-REG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

                    await pool.query(
                        `INSERT INTO public.transactions (
                            user_id, type, status, description, credits, monetary_value, payment_method, payment_id, value, due_date
                        ) VALUES ($1, 'purchase_credits', 'pending', $2, $3, $4, 'PIX', $5, $6, $7)`,
                        [
                            transacao.user_id,                               // $1
                            'Mensalidade Sitexpress - Próximo Ciclo',        // $2
                            50,                                              // $3
                            29.90,                                           // $4
                            txidNext,                                        // $5
                            29.90,                                           // $6
                            due_date                                         // $7
                        ]
                    );
                    console.log(`Próxima fatura (pendente) registrada para o usuário ${transacao.user_id} com vencimento: ${due_date.toISOString()}`);
                } else {
                    console.log(`Pagamento de R$ ${valorAtual} não gera próximo ciclo automático (não é premium ou dev).`);
                }
            } catch (nextCycleError) {
                console.error("Erro ao registrar próxima fatura:", nextCycleError);
            }
            // -----------------------------------------------------------------

            // NOTIFICAR ADMINISTRADOR (SUCESSO DA VENDA GERAL)
            try {
                await sendMail(
                    "contato@sitexpres.com",
                    "✅ Pagamento Confirmado (Inter PIX)",
                    `<p>Um novo pagamento foi processado via Banco Inter (PIX)!</p>
                     <p><b>Usuário:</b> ${result.rows[0].email}</p>
                     <p><b>Valor:</b> R$ ${transacao.monetary_value}</p>
                     <p><b>TXID:</b> ${txid}</p>
                     <p><b>Status da Nota:</b> ${notaFiscal.sucesso ? 'Gerada com Sucesso' : 'Erro ao Gerar'}</p>
                     ${notaFiscal.sucesso ? `<p><b>Chave de Acesso:</b> ${chaveAcesso}</p><p><b>Link de Consulta:</b> <a href="${linkNF}">${linkNF}</a></p>` : ''}`
                );
            } catch (mailErr) {
                console.error("Erro ao enviar email de notificação Inter:", mailErr);
            }

            return res.json({
                pago: true,
                status: "CONCLUIDA",
                mensagem: "Pagamento processado com sucesso!",
                creditsAdicionados: transacao.credits,
                RetornoNotaFiscal: notaFiscal,
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

        // Alerta de erro para o administrador
        try {
            await sendMail(
                "contato@sitexpres.com",
                "🚨 ERRO no Processamento de Pagamento (Inter PIX)",
                `<p>Ocorreu um erro ao consultar/processar o pagamento PIX <b>${req.body.txid}</b>.</p>
                 <p><b>Detalhes do erro:</b> ${error.message}</p>`
            );
        } catch (mailErr) {
            console.error("Erro ao enviar alerta de e-mail Inter:", mailErr);
        }

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
        nome,
        cpf,
        cnpj_cpf,
        razao_social,
        endereco,
        bairro,
        cod_municipio,
        uf,
        cep,
        telefone,
        email,
        userid,
        value,
        qtd_creditos
    } = req.body;

    // -----------------------------
    // 🔥 ATUALIZA USUÁRIO NO BANCO
    // -----------------------------
    const camposParaAtualizar = {
        cnpj_cpf,
        razao_social,
        endereco,
        bairro,
        cod_municipio,
        uf,
        cep,
        telefone,
        email
    };

    // Monta dinamicamente o SQL
    const sets = [];
    const values = [];

    let index = 1;

    for (const [campo, valor] of Object.entries(camposParaAtualizar)) {
        if (valor !== undefined && valor !== null && valor !== "") {
            sets.push(`${campo} = $${index}`);
            values.push(valor);
            index++;
        }
    }

    if (sets.length > 0) {
        values.push(userid); // último parâmetro no WHERE

        const sqlUpdate = `
                UPDATE users
                SET ${sets.join(", ")}, updated_at = NOW()
                WHERE id = $${index}
            `;

        await pool.query(sqlUpdate, values);
    }

    // -----------------------------
    // fluxo do PIX
    // -----------------------------

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
            expiracao: 3600 // 1 hora
        },
        valor: {
            original: valor
        },
        chave: process.env.INTER_CHAVE_PIX,
        solicitacaoPagador: "Pagamento Servico Sitexpress IA e WebHosting"
    };

    const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : '';
    if (cpfLimpo.length === 11) {
        payload.devedor = { nome: nome || 'Consumidor', cpf: cpfLimpo };
    } else if (cpfLimpo.length === 14) {
        payload.devedor = { nome: nome || 'Consumidor', cnpj: cpfLimpo };
    }

    const dataString = JSON.stringify(payload);

    const tokenObj = await gerarToken();
    // console.log(tokenObj)
    const accessToken = tokenObj.access_token;

    //---------------   
    //Salvado Transacao no banco de dados 
    const { existingTxId } = req.body;
    var ID_user = req.body.userid || "00";

    if (existingTxId) {
        // Se já existe um registro (ex: fatura registrada pelo back), atualiza ele
        console.log(`Atualizando transação existente ${existingTxId} com novo txid ${txid}`);
        await pool.query(
            `UPDATE public.transactions SET payment_id = $1, status = 'pending', updated_at = NOW() WHERE payment_id = $2 OR id::text = $2`,
            [txid, existingTxId]
        );
    } else {
        // Senão cria uma nova
        const transacao = await criarTransacao({
            ID_user,
            txid,
            valor,
            qtd_creditos,
            nome,
            cpf,
            descricao: 'Compra via pix Sitexpress IA e WebHosting',
            chave: process.env.INTER_CHAVE_PIX,
            expiracao: 3600,
            status: "pending"
        });
        console.log("Transacao salva no banco de dados:", transacao);
    }
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
                "Compra PIX",      // $3
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

const criarOrdemDominio = async ({
    txid,
    valor,
    user_id,
    reseller_customer_id,
    domain_name,
    domain_extension,
    full_domain,
    customer_name,
    customer_email,
    customer_phone,
    customer_company,
    customer_address,
    customer_city,
    customer_state,
    customer_country,
    customer_zipcode,
    status,
    id_projeto
}) => {
    try {
        const userId = user_id ?? null;
        const resellerId = reseller_customer_id ?? null;

        const valorFinal = Number(valor);
        if (isNaN(valorFinal)) {
            throw new Error("Valor inválido para domain_price");
        }

        const result = await pool.query(
            `
            INSERT INTO public.domain_orders (
                user_id,
                reseller_customer_id,
                domain_name,
                domain_extension,
                full_domain,
                domain_price,
                customer_name,
                customer_email,
                customer_phone,
                customer_company,
                customer_address,
                customer_city,
                customer_state,
                customer_country,
                customer_zipcode,
                status,
                payment_method,
                payment_reference,
                id_projeto
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                $11,$12,$13,$14,$15,$16,$17,$18,$19
            )
            RETURNING *
            `,
            [
                userId,            // $1
                resellerId,        // $2
                domain_name,       // $3
                domain_extension,  // $4
                full_domain,       // $5
                valorFinal,        // $6
                customer_name,     // $7
                customer_email,    // $8
                customer_phone,    // $9
                customer_company,  // $10
                customer_address,  // $11
                customer_city,     // $12
                customer_state,    // $13
                customer_country,  // $14
                customer_zipcode,  // $15
                status,            // $16
                'PIX',             // $17
                txid,              // $18
                id_projeto         // $19
            ]
        );

        return result.rows[0];

    } catch (err) {
        console.error("Erro ao criar ordem de domínio:", err.message);
        throw err;
    }
};

/* -----------------------------------------
     CONTROLLER — Pagamento para Reseller
--------------------------------------------*/
export const pagamentoDominio = async (req, res) => {
    const {
        // Dados do usuário
        user_id,
        reseller_customer_id,
        id_projeto,

        // Dados do domínio
        domain_name,
        domain_extension,
        full_domain,
        domain_price,

        // Dados do cliente
        customer_name,
        customer_email,
        customer_phone,
        customer_company,
        customer_address,
        customer_city,
        customer_state,
        customer_country,
        customer_zipcode,
        customer_cpf
    } = req.body;

    // Validação básica
    if (!full_domain || !domain_price || !customer_name || !customer_cpf) {
        return res.status(400).json({
            erro: "Dados obrigatórios não informados"
        });
    }

    const valor = domain_price;

    // Gerar TXID: "DOMINIO" (7) + Timestamp (13) + Random (8) = 28 chars
    const txid = "DOMINIO" + Date.now() + Math.random().toString(36).substring(2, 10);

    const payload = {
        calendario: {
            expiracao: 3600 // 1 hora
        },
        devedor: {
            nome: customer_name,
            cpf: customer_cpf.replace(/\D/g, '') // Remove formatação
        },
        valor: {
            original: valor
        },
        chave: process.env.INTER_CHAVE_PIX,
        solicitacaoPagador: `Registro de domínio: ${full_domain}`
    };

    const dataString = JSON.stringify(payload);

    try {
        const tokenObj = await gerarToken();
        const accessToken = tokenObj.access_token;

        const resellerId =
            reseller_customer_id && !isNaN(reseller_customer_id)
                ? Number(reseller_customer_id)
                : null;

        // Salvar ordem no banco de dados
        const ordem = await criarOrdemDominio({
            txid,
            valor: valor, // ✅ nome correto
            user_id: user_id || null,
            reseller_customer_id: resellerId,
            domain_name,
            domain_extension,
            full_domain,
            customer_name,
            customer_email,
            customer_phone,
            customer_company,
            customer_address,
            customer_city,
            customer_state,
            customer_country: customer_country || 'BR',
            customer_zipcode,
            status: "pending",
            payment_method: "pix",
            id_projeto
        });

        console.log("Ordem de domínio salva:", ordem);

        const options = {
            hostname: "cdpj.partners.bancointer.com.br",
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

            response.on("end", async () => {
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    const pixResponse = JSON.parse(data);

                    // Atualizar ordem com dados do PIX (opcional)
                    // await atualizarOrdemPix(ordem.id, pixResponse);

                    return res.json({
                        sucesso: true,
                        txid,
                        order_id: ordem.id,
                        full_domain: full_domain,
                        valor: valor,
                        pix: pixResponse
                    });
                } else {
                    // Atualizar status da ordem para 'failed'
                    await pool.query(
                        `UPDATE domain_orders SET status = 'failed' WHERE id = $1`,
                        [ordem.id]
                    );

                    return res.status(400).json({
                        erro: "Erro ao criar cobrança PIX",
                        status: response.statusCode,
                        detalhes: data
                    });
                }
            });
        });

        request.on("error", async (e) => {
            console.error("Erro PIX:", e);

            // Atualizar status da ordem para 'failed'
            await pool.query(
                `UPDATE domain_orders SET status = 'failed' WHERE id = $1`,
                [ordem.id]
            );

            res.status(500).json({ erro: e.message });
        });

        request.write(dataString);
        request.end();

    } catch (err) {
        console.error("Erro no pagamento de domínio:");
        console.error(err.message);
        console.error(err.stack);

        res.status(500).json({
            erro: "Erro interno ao processar pagamento",
            message: err.message
        });
    }

};

export const consultarPix_dominio = async (req, res) => {
    try {
        var { txid } = req.body;
        console.log("==> Consultando cobrança PIX...", txid);

        if (!txid) {
            return res.status(400).json({ error: "TXID é obrigatório para consultar a cobrança." });
        }

        txid = 'SITEXPRES1765223615757cp4pwcnk';

        // 1. Gera token com escopo necessário
        const tokenData = await gerarToken();
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
        /*     
        if (respostaInter.status !== "CONCLUIDA") {
                console.log(`Pix ${txid} ainda não pago. Status: ${respostaInter.status || 'não encontrado'}`);
                return res.json({
                    pago: false,
                    status: respostaInter.status || 'não encontrado',
                    mensagem: "Aguardando pagamento..."
                });
            }
        */

        // 4. AQUI O PAGAMENTO ESTÁ CONCLUÍDO NO INTER!
        console.log(`PAGAMENTO CONFIRMADO no Inter! Valor: ${respostaInter.valor?.original}`);

        // 5. Busca a transação no seu banco
        const result = await pool.query(
            `SELECT * FROM public.domain_orders WHERE payment_reference = $1`,
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
            console.log("Pagamento processado com sucesso!");

            // Adiciona créditos
            await pool.query(
                `UPDATE public.domain_orders SET status = 'completed' WHERE id = $1`,
                [transacao.id]
            );

            //Consultar dados do usuário para nota fiscal
            const result_user = await pool.query(
                `SELECT * FROM public.users WHERE id = $1`,
                [transacao.user_id]
            );

            // ENVIA NOTA FISCAL
            var notaFiscal = await gerandonotafiscal({
                valor_servico: transacao.domain_price,
                cnpj_cpf: result_user.rows[0].cnpj_cpf,
                razao_social: result_user.rows[0].razao_social || result_user.rows[0].name,
                endereco: result_user.rows[0].endereco,
                bairro: result_user.rows[0].bairro,
                cod_municipio: result_user.rows[0].cod_municipio,
                uf: result_user.rows[0].uf,
                cep: result_user.rows[0].cep,
                telefone: result_user.rows[0].telefone,
                email: result_user.rows[0].email
            });

            console.log("Retorno NF:", notaFiscal);

            // Converte o JSON da resposta
            const responseNF = JSON.parse(notaFiscal.resposta_nf);

            // Separa somente o link
            const linkNF = responseNF.message?.split("||")[1] || null;

            console.log("Link de Consulta:", linkNF);

            // Salva o link no banco
            await pool.query(
                `UPDATE public.domain_orders SET link_nota = $1 WHERE id = $2`,
                [linkNF, transacao.id]
            );

            //###############
            // Criando cliente no resseller
            //###############
            var data_customer = await createCustomerReseller_funcao({
                email: result_user.rows[0].email,
                password: result_user.rows[0].password,
                name: result_user.rows[0].name,
                company: result_user.rows[0].company,
                addressLine1: result_user.rows[0].endereco,
                city: result_user.rows[0].bairro,
                state: result_user.rows[0].uf,
                country: 'BR',
                zipCode: result_user.rows[0].cep,
                phoneCountryCode: '55',
                phone: result_user.rows[0].telefone,
                langPref: result_user.rows[0].langPref || 'pt'
            });

            //###############
            // Ativando Dominio no resseller
            //###############
            const estadosBR = {
                AC: 'Acre',
                AL: 'Alagoas',
                AP: 'Amapa',
                AM: 'Amazonas',
                BA: 'Bahia',
                CE: 'Ceara',
                DF: 'Distrito Federal',
                ES: 'Espirito Santo',
                GO: 'Goias',
                MA: 'Maranhao',
                MT: 'Mato Grosso',
                MS: 'Mato Grosso do Sul',
                MG: 'Minas Gerais',
                PA: 'Para',
                PB: 'Paraiba',
                PR: 'Parana',
                PE: 'Pernambuco',
                PI: 'Piaui',
                RJ: 'Rio de Janeiro',
                RN: 'Rio Grande do Norte',
                RS: 'Rio Grande do Sul',
                RO: 'Rondonia',
                RR: 'Roraima',
                SC: 'Santa Catarina',
                SP: 'Sao Paulo',
                SE: 'Sergipe',
                TO: 'Tocantins'
            };

            // 🔒 Blindagem dos dados do usuário
            const user = result_user?.rows?.[0];

            if (!user) {
                throw new Error('Usuário não encontrado para criação do contato');
            }

            // 🔧 Normalizações
            const uf = user.uf?.toUpperCase?.();
            const stateNormalized = estadosBR[uf] || 'NA';

            const phone = String(user.telefone || '').replace(/\D/g, '');
            const safePhone = phone.length >= 10 ? phone : '11999999999';

            const cityNormalized = user.bairro
                ? user.bairro.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                : 'NA';

            const zipCodeNormalized = String(user.cep || '').replace(/\D/g, '') || '00000000';

            var data_customer = await create_domain_reseller_funcao(
                transacao.full_domain,
                data_customer.data,
                {
                    contactData: {
                        name: user.name || 'Contato Default',
                        email: user.email,
                        phone: safePhone,
                        phoneCountryCode: '55',
                        company: user.company || 'Empresa default',
                        addressLine1: user.endereco || 'Endereco nao informado',
                        city: cityNormalized,
                        state: stateNormalized,
                        country: 'BR',
                        zipCode: zipCodeNormalized
                    }
                }
            );

            // NOTIFICAR ADMINISTRADOR (SUCESSO DOMÍNIO)
            try {
                await sendMail(
                    "contato@sitexpres.com",
                    "✅ Domínio Registrado e Pago (Inter PIX)",
                    `<p>Um novo domínio foi pago via Banco Inter (PIX)!</p>
                     <p><b>Domínio:</b> ${transacao.full_domain}</p>
                     <p><b>Cliente:</b> ${user.name} (${user.email})</p>
                     <p><b>Valor:</b> R$ ${transacao.domain_price}</p>
                     <p><b>TXID:</b> ${txid}</p>
                     <p><b>Link de Consulta:</b> <a href="${linkNF}">${linkNF}</a></p>`
                );
            } catch (mailErr) {
                console.error("Erro ao enviar email de notificação Inter domínio:", mailErr);
            }

            return res.json({
                pago: true,
                status: "CONCLUIDA",
                mensagem: "Pagamento processado com sucesso!",
                domain: transacao.full_domain,
                data_customer: data_customer,
                RetornoNotaFiscal: linkNF
            });
        }

        // Caso raro (ex: cancelled)
        /*  return res.json({
             pago: true,
             status: "CONCLUIDA",
             mensagem: `Transação com status ${transacao.status} (não processada)`
         }); */
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

