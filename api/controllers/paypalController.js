// controllers/paypalController.js
import client from './paypal.js';
import checkoutNodeJssdk from '@paypal/checkout-server-sdk';
import fetch from 'node-fetch';
import 'dotenv/config';
import pool from "../config/db.js";
import fs from 'fs/promises';
import path from 'path';
import { createHospedagem_funcao } from './hospedagemController.js';
import { sendMail } from '../services/emailService.js';
import { buildStyledEmail } from '../services/emailTemplateBuilder.js';
import { gerandonotafiscal, gerarNotaNacional } from '../services/notafiscalService.js';

// ==================== FUNÇÕES AUXILIARES ====================

async function getAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch(
    `${process.env.PAYPAL_BASE_URL || 'https://api-m.paypal.com'}/v1/oauth2/token`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    }
  );

  const data = await response.json();
  return data.access_token;
}

// ==================== PAGAMENTO ÚNICO ====================

export async function createOrder(req, res) {
  try {
    const request = new checkoutNodeJssdk.orders.OrdersCreateRequest();
    request.prefer("return=representation");

    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "BRL",
            value: req.body.value || "29.90"
          },
          description: req.body.description || "Pagamento SitExpres"
        }
      ],
      application_context: {
        brand_name: "sitexpres.com.br",
        landing_page: "BILLING",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        return_url: "https://back.sitexpres.com.br/api/paypal/pagamento/sucesso",
        cancel_url: "https://back.sitexpres.com.br/api/paypal/pagamento/cancelado"
      }
    });

    const response = await client.execute(request);

    //console.log(response.result)

    //---- inserindo transando no banco como pendente

    var qtd_credito = req.body.qtd_creditos || 10;
    var valor = req.body.value || "29.90";
    var typePayment = req.body.tipoPagamento || 'PayPall';
    var Payment_id = response.result.id || "29.90";
    var ID_user = req.body.userid || "00";
    var Url_Pagamento = response.result.links.find(l => l.rel === "approve")?.href || 'Sem URL';

    pool.query(
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
          'pending',
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8
        )
      `,
      [
        ID_user,
        `Compra de ${qtd_credito} créditos`,
        qtd_credito,
        valor,
        typePayment,
        Payment_id,
        Url_Pagamento,
        valor
      ]
    );

    return res.json({
      id: response.result.id,
      approve: response.result.links.find(l => l.rel === "approve")?.href
    });

  } catch (err) {
    console.error("ERRO PAYPAL ORDER:", err.response?.result || err);
    return res.status(500).json({
      error: "Erro ao criar pedido",
      details: err.response?.result || err.message
    });
  }
}

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
        'PAYPAL',          // $17
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

export async function createOrder_dominio(req, res) {
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
  if (!full_domain || !domain_price || !customer_name || !customer_email) {
    return res.status(400).json({
      erro: "Dados obrigatórios não informados"
    });
  }

  try {
    const request = new checkoutNodeJssdk.orders.OrdersCreateRequest();
    request.prefer("return=representation");

    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "BRL",
            value: domain_price.toString()
          },
          description: `Registro de domínio: ${full_domain}`
        }
      ],
      application_context: {
        brand_name: "sitexpres.com.br",
        landing_page: "BILLING",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        return_url: "https://back.sitexpres.com.br/api/paypal/dominio/sucesso",
        cancel_url: "https://back.sitexpres.com.br/api/paypal/dominio/cancelado"
      }
    });

    const response = await client.execute(request);

    const payment_id = response.result.id;
    const approve_url = response.result.links.find(l => l.rel === "approve")?.href || '';

    const resellerId =
      reseller_customer_id && !isNaN(reseller_customer_id)
        ? Number(reseller_customer_id)
        : null;

    // Salvar ordem no banco de dados
    const ordem = await criarOrdemDominio({
      txid: payment_id, // Usando o PayPal Order ID como txid
      valor: domain_price,
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
      payment_method: "paypal",
      id_projeto
    });

    console.log("Ordem de domínio PayPal salva:", ordem);

    return res.json({
      sucesso: true,
      order_id: ordem.id,
      payment_id: payment_id,
      full_domain: full_domain,
      valor: domain_price,
      approve_url: approve_url
    });

  } catch (err) {
    console.error("ERRO PAYPAL ORDER DOMÍNIO:", err.response?.result || err);
    console.error(err.stack);

    return res.status(500).json({
      erro: "Erro ao criar pedido PayPal",
      message: err.message,
      details: err.response?.result || err.message
    });
  }
}

export async function captureOrder(req, res) {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: "Token não fornecido" });
    }

    const request = new checkoutNodeJssdk.orders.OrdersCaptureRequest(token);
    request.requestBody({});

    const response = await client.execute(request);

    console.log("✅ Pagamento aprovado:", response.result.id);

    // Aqui você pode salvar no banco de dados
    const paymentData = {
      order_id: response.result.id,
      status: response.result.status,
      payer_email: response.result.payer?.email_address,
      amount: response.result.purchase_units[0].amount.value,
      currency: response.result.purchase_units[0].amount.currency_code
    };

    return res.json({
      success: true,
      payment: paymentData
    });

  } catch (err) {
    console.error("ERRO AO CAPTURAR:", err);
    return res.status(500).json({
      error: "Erro ao capturar pagamento",
      details: err.message
    });
  }
}

export async function paymentSuccess(req, res) {
  try {
    const { token } = req.query;

    console.log("✅ Pagamento concluído! Order ID:", token);

    //consultado no banco se existe token para o pagamento
    const payment = await pool.query(
      `SELECT * FROM public.transactions where payment_id = $1`,
      [token]
    );

    if (payment.rows.length === 0) {

      // verificando ordem de pagamento para registro de domínio
      const payment_dominio = await pool.query(
        `SELECT * FROM public.domain_orders where payment_reference = $1`,
        [token]
      );

      if (payment_dominio.rows.length === 0) {
        console.error("Pagamento não encontrado para o token:", token);
        return res.status(404).send("Pagamento não encontrado");
      } else {
        if (payment_dominio.rows[0].status === 'completed') {
          console.log(`Pagamento ${token} já foi processado antes.`);
          return res.json({
            pago: true,
            status: "CONCLUIDA",
            jaProcessado: true,
            mensagem: "Pagamento já creditado!",
            redirect: `https://sitexpres.com.br/sucesso?order=${token}`
          });
        } else {
          console.log("Pagamento processado com sucesso!");

          var transacao = payment_dominio.rows[0];
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
          var notaFiscal = await gerarNotaNacional({
            valor_servico: transacao.domain_price,
            cnpj_cpf: result_user.rows[0].cnpj_cpf,
            razao_social: result_user.rows[0].razao_social || result_user.rows[0].name,
            endereco: result_user.rows[0].endereco,
            bairro: result_user.rows[0].bairro,
            cod_municipio: result_user.rows[0].cod_municipio,
            uf: result_user.rows[0].uf,
            cep: result_user.rows[0].cep,
            telefone: result_user.rows[0].telefone,
            email: result_user.rows[0].email,
            descricao: `Registro de Domínio: ${transacao.full_domain}`
          });

          console.log("Retorno NF Nacional (Domínio):", notaFiscal);

          let linkNF = null;
          let chaveAcesso = null;

          if (notaFiscal.sucesso) {
            linkNF = notaFiscal.linkConsulta;
            chaveAcesso = notaFiscal.chaveAcesso;
            
            try {
                const isForeign = (result_user.rows[0].uf === "EX" || result_user.rows[0].cep === "00000000");
                let clientTheme = {
                    title: "Sua Nota Fiscal foi gerada! 📄",
                    subject: "📄 Sua Nota Fiscal foi gerada!",
                    text1: `Sua Nota Fiscal de Serviços Eletrônica (NFS-e) para o domínio ${transacao.full_domain} foi emitida com sucesso!`,
                    text2: "Para consultar ou baixar o PDF, <b>copie a Chave de Acesso abaixo</b> e acesse a página oficial do governo:",
                    btn: "Consultar NFS-e"
                };
                if (isForeign) {
                    clientTheme = {
                        title: "Your Invoice has been generated! 📄",
                        subject: "📄 Your Invoice has been generated!",
                        text1: `Your Commercial Invoice (NFS-e) for the domain ${transacao.full_domain} has been successfully issued!`,
                        text2: "To view or download the PDF of your invoice, <b>copy the Access Key below</b> and paste it on the official government page:",
                        btn: "View Invoice"
                    };
                }

                const clientHtml = buildStyledEmail(
                    clientTheme.title,
                    result_user.rows[0].name,
                    `<p class="email-text">${clientTheme.text1}</p>
                     <p class="email-text">${clientTheme.text2}</p>
                     <div class="chave-box">${chaveAcesso}</div>
                     <p class="email-text"><a href="${linkNF}">${linkNF}</a></p>`,
                    clientTheme.btn,
                    linkNF
                );

                await sendMail(
                    result_user.rows[0].email,
                    clientTheme.subject,
                    clientHtml
                );
            } catch (emailErr) {
                console.error("Erro email cliente NF:", emailErr);
            }
          } else {
            console.error("Falha ao gerar NF Nacional Domínio:", notaFiscal.mensagem, notaFiscal.erro);
            try {
                const errorMsg = typeof notaFiscal.erro === 'object' ? JSON.stringify(notaFiscal.erro) : notaFiscal.erro;
                await sendMail(
                    "contato@sitexpres.com",
                    "🚨 ERRO ao Gerar Nota Fiscal (PayPal Domínio)",
                    `<p>Erro Nota Fiscal. Transação: <b>${token}</b> (Usuário: ${result_user.rows[0].email}).</p>
                     <p><b>Mensagem:</b> ${notaFiscal.mensagem}</p>
                     <p><b>Detalhes do Erro:</b> ${errorMsg}</p>`
                );
            } catch (emailErr) {} } 

        // Envia notificação ao ADM com chave
        let isForeignAdmin = (result_user.rows[0].uf === "EX" || result_user.rows[0].cep === "00000000");
        let subjAdmin = isForeignAdmin ? `✅ [GRINGO] ${transactionDetails.resource.description} Pago (PayPal)` : `✅ ${transactionDetails.resource.description} Pago (PayPal)`;
        let pbodyAdmin = `<p>Um novo plano/crédito foi pago via PayPal!</p>
             <p><b>Cliente:</b> ${result.rows[0].name} (${result.rows[0].email})</p>
             <p><b>Descrição:</b> ${transactionDetails.resource.description}</p>
             <p><b>Valor:</b> ${transactionDetails.resource.amount.total} ${transactionDetails.resource.amount.currency}</p>
             <p><b>Transação:</b> ${transactionId}</p>
             <p><b>ID Assinatura:</b> ${subscriptionId}</p>
             ${notaFiscal.sucesso ? `<p><b>Chave da NFS-e:</b> ${chaveAcesso}</p><p><b>Link de Consulta:</b> <a href="${linkNF}">${linkNF}</a></p>` : `<p><b>Nota Fiscal:</b> Falha na geração.</p>`}`;
             
        if (isForeignAdmin) pbodyAdmin = `<b>⚠️ PAGAMENTO DE CLIENTE GRINGO (EXTERIOR)</b><br><br>` + pbodyAdmin;

        sendMail("contato@sitexpres.com", subjAdmin, pbodyAdmin);

          // Notificação Admin do Novo Domínio
          sendMail(
              "contato@sitexpres.com",
              "✅ Novo Domínio Registrado e Pago (PayPal)",
              `<p>Um novo domínio foi pago via PayPal!</p>
               <p><b>Domínio:</b> ${transacao.full_domain}</p>
               <p><b>Cliente:</b> ${transacao.customer_name} (${transacao.customer_email})</p>
               <p><b>Valor:</b> R$ ${transacao.domain_price}</p>
               <p><b>Transação:</b> ${token}</p>
               ${notaFiscal.sucesso ? `<p><b>Chave da NFS-e:</b> ${chaveAcesso}</p><p><b>Link de Consulta:</b> <a href="${linkNF}">${linkNF}</a></p>` : `<p><b>Nota Fiscal:</b> Falha na geração.</p>`}`
          );

          console.log("Link da Nota Fiscal Domínio salva:", linkNF);

          // Salva o link no banco
          await pool.query(
            `UPDATE public.domain_orders SET link_nota = $1 WHERE id = $2`,
            [linkNF || chaveAcesso || 'ERRO_EMISSAO', transacao.id]
          );

          console.log("Criando Hospedagem");

          var hospedagem_retorno = await createHospedagem_funcao({
            dominio: transacao.full_domain,
            nome: transacao.customer_name,
            email: transacao.customer_email,
            bandwidth: transacao.bandwidth,
            quota: transacao.quota,
            ip: transacao.ip || '143.208.8.36',
            id_projeto: transacao.id_projeto,
            id_user: transacao.user_id
          });

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

          var dados_reseller = await create_domain_reseller_funcao(
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
              "✅ Domínio Registrado e Pago (PayPal)",
              `<p>Um novo domínio foi pago via PayPal!</p>
               <p><b>Domínio:</b> ${transacao.full_domain}</p>
               <p><b>Cliente:</b> ${transacao.customer_name} (${transacao.customer_email})</p>
               <p><b>Valor:</b> R$ ${transacao.domain_price}</p>
               <p><b>Transação:</b> ${token}</p>
               <p><b>Link de Consulta:</b> <a href="${linkNF}">${linkNF}</a></p>`
            );
          } catch (mailErr) {
            console.error("Erro ao enviar email de notificação PayPal domínio:", mailErr);
          }

          return res.json({
            pago: true,
            status: "CONCLUIDA",
            mensagem: "Pagamento processado com sucesso!",
            domain: transacao.full_domain,
            RetornoNotaFiscal: (typeof notaFiscal !== 'undefined' ? notaFiscal : null),
            hospedagem: (typeof hospedagem_retorno !== 'undefined' ? hospedagem_retorno : null),
            reseller: (typeof dados_reseller !== 'undefined' ? dados_reseller : null)
          });
        }
      }

    } else {

      // Check if transaction is pending before adding credits
      if (payment.rows[0].status === 'pending') {
        console.log('Pagamento pendente, adicionando créditos ao usuário!');
        //Atualizando o usuario
        await pool.query(
          `UPDATE public.users SET credits = credits + $1 WHERE id = $2`,
          [payment.rows[0].credits, payment.rows[0].user_id]
        );

        //Fazendo Update no pagamento
        await pool.query(
          `UPDATE public.transactions SET status = 'completed' WHERE payment_id = $1`,
          [token]
        );

        const result = await pool.query(
          `SELECT * FROM public.users WHERE id = $1`,
          [payment.rows[0].user_id]
        );

        // ENVIA NOTA FISCAL
        var notaFiscal = await gerarNotaNacional({
          valor_servico: payment.rows[0].monetary_value,
          cnpj_cpf: result.rows[0].cnpj_cpf,
          razao_social: result.rows[0].razao_social || result.rows[0].name,
          endereco: result.rows[0].endereco,
          bairro: result.rows[0].bairro,
          cod_municipio: result.rows[0].cod_municipio,
          uf: result.rows[0].uf,
          cep: result.rows[0].cep,
          telefone: result.rows[0].telefone,
          email: result.rows[0].email,
          descricao: `Compra de Créditos/Assinatura via PayPal - Transação: ${token}`
        });

        console.log("Retorno NF Nacional (PayPal Créditos):", notaFiscal);

        let linkNF = null;
        let chaveAcesso = null;

        if (notaFiscal.sucesso) {
            linkNF = notaFiscal.linkConsulta;
            chaveAcesso = notaFiscal.chaveAcesso;
            
            try {
                const isForeignCred = (result.rows[0].uf === "EX" || result.rows[0].cep === "00000000");
                let clientThemeCred = {
                    title: "Sua Nota Fiscal foi gerada! 📄",
                    subject: "📄 Sua Nota Fiscal foi gerada!",
                    text1: "Sua Nota Fiscal de Serviços Eletrônica (NFS-e) referente ao seu pagamento via PayPal foi emitida com sucesso!",
                    text2: "Para consultar ou baixar o PDF, <b>copie a Chave de Acesso abaixo</b> e acesse a página oficial do governo:",
                    btn: "Consultar NFS-e"
                };
                if (isForeignCred) {
                    clientThemeCred = {
                        title: "Your Invoice has been generated! 📄",
                        subject: "📄 Your Invoice has been generated!",
                        text1: "Your Commercial Invoice (NFS-e) for your PayPal payment has been successfully issued!",
                        text2: "To view or download the PDF of your invoice, <b>copy the Access Key below</b> and paste it on the official government page:",
                        btn: "View Invoice"
                    };
                }

                const clientHtml = buildStyledEmail(
                    clientThemeCred.title,
                    result.rows[0].name,
                    `<p class="email-text">${clientThemeCred.text1}</p>
                     <p class="email-text">${clientThemeCred.text2}</p>
                     <div class="chave-box">${chaveAcesso}</div>
                     <p class="email-text"><a href="${linkNF}">${linkNF}</a></p>`,
                    clientThemeCred.btn,
                    linkNF
                );
                await sendMail(result.rows[0].email, clientThemeCred.subject, clientHtml);

            } catch (emailErr) {}
        } else {
            console.error("Falha ao gerar NF Nacional PayPal:", notaFiscal.mensagem, notaFiscal.erro);
            try {
                const errorMsg = typeof notaFiscal.erro === 'object' ? JSON.stringify(notaFiscal.erro) : notaFiscal.erro;
                await sendMail(
                    "contato@sitexpres.com",
                    "🚨 ERRO ao Gerar Nota Fiscal (PayPal Créditos)",
                    `<p>Erro Nota Fiscal. Transação: <b>${token}</b> (Usuário: ${result.rows[0].email}).</p>
                     <p><b>Mensagem:</b> ${notaFiscal.mensagem}</p>
                     <p><b>Detalhes do Erro:</b> ${errorMsg}</p>`
                );
            } catch (emailErr) {} } 

        // Envia notificação ao ADM com chave
        let isForeignAdminCred = (result.rows[0].uf === "EX" || result.rows[0].cep === "00000000");
        let subjCred = isForeignAdminCred ? `✅ [GRINGO] ${transactionDetails.resource.description} Pago (PayPal)` : `✅ ${transactionDetails.resource.description} Pago (PayPal)`;
        let pbodyCred = `<p>Um novo plano/crédito foi pago via PayPal!</p>
             <p><b>Cliente:</b> ${result.rows[0].name} (${result.rows[0].email})</p>
             <p><b>Descrição:</b> ${transactionDetails.resource.description}</p>
             <p><b>Valor:</b> ${transactionDetails.resource.amount.total} ${transactionDetails.resource.amount.currency}</p>
             <p><b>Transação:</b> ${transactionId}</p>
             <p><b>ID Assinatura:</b> ${subscriptionId}</p>
             ${notaFiscal.sucesso ? `<p><b>Chave da NFS-e:</b> ${chaveAcesso}</p><p><b>Link de Consulta:</b> <a href="${linkNF}">${linkNF}</a></p>` : `<p><b>Nota Fiscal:</b> Falha na geração.</p>`}`;
             
        if (isForeignAdminCred) pbodyCred = `<b>⚠️ PAGAMENTO DE CLIENTE GRINGO (EXTERIOR)</b><br><br>` + pbodyCred;

        sendMail("contato@sitexpres.com", subjCred, pbodyCred);

        console.log("Link da Nota Fiscal PayPal salva:", linkNF);

        // Salva o link no banco
        await pool.query(
          `UPDATE public.transactions SET nota_fiscal = $1 WHERE payment_id = $2`,
          [linkNF || chaveAcesso || 'ERRO_EMISSAO', payment.rows[0].payment_id]
        );

        // =================================================================
        // PARIDADE COM INTER: LÓGICA PREMIUM E PRÓXIMO CICLO
        // =================================================================
        try {
            const user_id = payment.rows[0].user_id;
            const monetary_value = payment.rows[0].monetary_value;
            const txid = token;

            // 1. VERIFICA SE O USUÁRIO JÁ É PREMIUM. SE NÃO FOR, SALVA OS CRÉDITOS ATUAIS COMO FREE CREDITS
            const checkPlan = await pool.query(
                `SELECT plan FROM public.user_subscriptions WHERE user_id = $1 AND is_active = true`,
                [user_id]
            );
            
            const isPremium = checkPlan.rows.length > 0 && checkPlan.rows[0].plan === 'premium';
            
            if (!isPremium) {
                await pool.query(
                    `UPDATE public.users SET free_credits = credits WHERE id = $1`,
                    [user_id]
                );
                console.log(`Créditos free salvos (backup) para o usuário ${user_id}`);
            }

            // 2. Colocar usuário como premium em user_subscriptions
            await pool.query(
                `UPDATE public.user_subscriptions SET is_active = false WHERE user_id = $1 AND is_active = true`,
                [user_id]
            );

            await pool.query(
                `INSERT INTO public.user_subscriptions (user_id, plan, is_active) 
                 VALUES ($1, 'premium', true)`,
                [user_id]
            );

            // 3. REGISTRAR PRÓXIMO CICLO (Fatura Pendente)
            const valorAtual = parseFloat(monetary_value);
            const isDev = process.env.DEV_MODE === 'true';

            if (valorAtual >= 29.90 || isDev) {
                console.log(`Registrando próximo ciclo para valor: ${valorAtual} (Dev: ${isDev})`);
                
                const due_date = new Date();
                due_date.setMonth(due_date.getMonth() + 1);

                const txidNext = `PENDING-REG-PAYPAL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

                await pool.query(
                    `INSERT INTO public.transactions (
                        user_id, type, status, description, credits, monetary_value, payment_method, payment_id, value, due_date
                    ) VALUES ($1, 'purchase_credits', 'pending', $2, $3, $4, 'PAYPAL', $5, $6, $7)`,
                    [
                        user_id,                                         // $1
                        'Mensalidade Sitexpress - Próximo Ciclo',        // $2
                        50,                                              // $3
                        29.90,                                           // $4
                        txidNext,                                        // $5
                        29.90,                                           // $6
                        due_date                                         // $7
                    ]
                );
                console.log(`Próxima fatura (pendente) registrada para o usuário ${user_id}`);
            }

            // 4. NOTIFICAR ADMINISTRADOR (SUCESSO)
            await sendMail(
                "contato@sitexpres.com",
                "✅ Pagamento Confirmado (PayPal) e Nota Gerada",
                `<p>Um novo pagamento foi processado via PayPal!</p>
                 <p><b>Usuário:</b> ${result.rows[0].name} (${result.rows[0].email})</p>
                 <p><b>Valor:</b> R$ ${monetary_value}</p>
                 <p><b>Transação:</b> ${token}</p>
                 <p><b>Link de Consulta:</b> <a href="${linkNF}">${linkNF}</a></p>`
            );

        } catch (parityError) {
            console.error("Erro na lógica de paridade/notificação PayPal:", parityError);
            // Notifica erro de paridade mas não trava o redirect de sucesso do usuário
            await sendMail(
                "contato@sitexpres.com",
                "⚠️ ALERTA: Falha na Paridade/Notificação (PayPal)",
                `<p>O pagamento <b>${token}</b> foi concluído, mas houve um erro na lógica secundária (Premium/Próximo Ciclo/E-mail).</p>
                 <p><b>Erro:</b> ${parityError.message}</p>`
            );
        }
        // =================================================================

      } else {
        console.log(`Pagamento ${token} já processado anteriormente. Status atual: ${payment.rows[0].status}`);
      }
    }

    // Redirecionar para frontend
    return res.redirect(`https://sitexpres.com.br/sucesso?order=${token}`);

  } catch (err) {
    console.error("ERRO:", err);
    
    // Alerta de erro para o administrador
    try {
      await sendMail(
        "contato@sitexpres.com",
        "🚨 ERRO no Processamento de Pagamento (PayPal)",
        `<p>Ocorreu um erro ao processar o pagamento PayPal <b>${req.query.token}</b>.</p>
         <p><b>Detalhes do erro:</b> ${err.message}</p>
         <p>Verifique o banco de dados e os logs do sistema imediatamente.</p>`
      );
    } catch (mailErr) {
      console.error("Erro ao enviar e-mail de alerta:", mailErr);
    }

    return res.status(500).send("Erro ao processar pagamento");
  }
}

export async function paymentCancel(req, res) {
  console.log("❌ Pagamento cancelado pelo usuário");
  return res.redirect('https://sitexpres.com.br/cancelado');
}

// ==================== ASSINATURAS - SETUP (EXECUTAR 1 VEZ) ====================

export async function createProduct(req, res) {
  try {
    const token = await getAccessToken();

    const productData = {
      name: req.body.name || "SitExpres Premium",
      description: req.body.description || "Acesso à plataforma SitExpres",
      type: "SERVICE",
      category: "SOFTWARE",
      image_url: req.body.image_url || "https://sitexpres.com.br/logo.png",
      home_url: "https://sitexpres.com.br"
    };

    const response = await fetch(
      `${process.env.PAYPAL_BASE_URL || 'https://api-m.paypal.com'}/v1/catalogs/products`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(productData)
      }
    );

    const product = await response.json();

    if (product.error || product.name === 'INVALID_REQUEST') {
      console.error("ERRO AO CRIAR PRODUTO:", product);
      return res.status(400).json({
        error: product.message || "Erro ao criar produto",
        details: product.details || product
      });
    }

    console.log("✅ Produto criado:", product.id);

    return res.json({
      product_id: product.id,
      name: product.name,
      message: "⚠️ IMPORTANTE: Guarde este product_id no seu .env como PAYPAL_PRODUCT_ID"
    });

  } catch (err) {
    console.error("ERRO:", err);
    return res.status(500).json({
      error: "Erro ao criar produto",
      details: err.message
    });
  }
}

export async function createSubscriptionPlan(req, res) {
  try {
    const token = await getAccessToken();

    if (!process.env.PAYPAL_PRODUCT_ID) {
      return res.status(400).json({
        error: "PAYPAL_PRODUCT_ID não configurado no .env. Execute /setup/produto primeiro."
      });
    }

    const planData = {
      product_id: process.env.PAYPAL_PRODUCT_ID,
      name: req.body.name || "Plano Mensal SitExpres",
      description: req.body.description || "Assinatura mensal da plataforma",
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: {
            interval_unit: req.body.interval_unit || "MONTH",
            interval_count: req.body.interval_count || 1
          },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: req.body.total_cycles || 0, // 0 = infinito
          pricing_scheme: {
            fixed_price: {
              value: req.body.value || "49.90",
              currency_code: "BRL"
            }
          }
        }
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3,
        setup_fee: {
          value: "0",
          currency_code: "BRL"
        }
      },
      taxes: {
        inclusive: false
      }
    };

    const response = await fetch(
      `${process.env.PAYPAL_BASE_URL || 'https://api-m.paypal.com'}/v1/billing/plans`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(planData)
      }
    );

    const plan = await response.json();

    if (plan.error || plan.name === 'INVALID_REQUEST') {
      console.error("ERRO AO CRIAR PLANO:", plan);
      return res.status(400).json({
        error: plan.message || "Erro ao criar plano",
        details: plan.details || plan
      });
    }

    console.log("✅ Plano criado:", plan.id);

    return res.json({
      plan_id: plan.id,
      name: plan.name,
      price: plan.billing_cycles[0].pricing_scheme.fixed_price.value,
      message: "⚠️ IMPORTANTE: Guarde este plan_id no seu .env como PAYPAL_PLAN_ID"
    });

  } catch (err) {
    console.error("ERRO:", err);
    return res.status(500).json({
      error: "Erro ao criar plano",
      details: err.message
    });
  }
}

// ==================== ASSINATURAS - USO NORMAL ====================

export async function createSubscription(req, res) {
  try {
    const token = await getAccessToken();
    const { email, name, surname } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email é obrigatório" });
    }

    if (!process.env.PAYPAL_PLAN_ID) {
      return res.status(400).json({
        error: "PAYPAL_PLAN_ID não configurado no .env. Execute /setup/plano primeiro."
      });
    }

    const subscriptionData = {
      plan_id: process.env.PAYPAL_PLAN_ID,

      subscriber: {
        email_address: email,
        name: {
          given_name: name || "Cliente",
          surname: surname || "SitExpres"
        }
      },

      application_context: {
        brand_name: "sitexpres.com.br",
        //locale: "pt_BR",
        landing_page: "BILLING", // Força tela de cartão
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        payment_method: {
          payer_selected: "PAYPAL",
          payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED"
        },
        return_url: "https://back.sitexpres.com.br/api/paypal/assinatura/sucesso",
        cancel_url: "https://back.sitexpres.com.br/api/paypal/assinatura/cancelado"
      }
    };

    const response = await fetch(
      `${process.env.PAYPAL_BASE_URL || 'https://api-m.paypal.com'}/v1/billing/subscriptions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `SUB-${Date.now()}`
        },
        body: JSON.stringify(subscriptionData)
      }
    );

    const subscription = await response.json();

    if (subscription.name === 'INVALID_REQUEST' || subscription.error) {
      console.error("ERRO PAYPAL:", subscription);
      return res.status(400).json({
        error: subscription.message || "Erro ao criar assinatura",
        details: subscription.details || subscription
      });
    }

    const approveLink = subscription.links?.find(l => l.rel === 'approve')?.href;

    console.log("✅ Assinatura criada:", subscription.id);

    return res.json({
      subscription_id: subscription.id,
      approve: approveLink,
      status: subscription.status
    });

  } catch (err) {
    console.error("ERRO AO CRIAR ASSINATURA:", err);
    return res.status(500).json({
      error: "Erro ao criar assinatura",
      details: err.message
    });
  }
}

export async function getSubscriptionStatus(req, res) {
  try {
    const { subscriptionId } = req.params;
    const token = await getAccessToken();

    const response = await fetch(
      `${process.env.PAYPAL_BASE_URL || 'https://api-m.paypal.com'}/v1/billing/subscriptions/${subscriptionId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const subscription = await response.json();

    if (subscription.error) {
      return res.status(404).json({
        error: "Assinatura não encontrada",
        details: subscription
      });
    }

    return res.json({
      id: subscription.id,
      status: subscription.status,
      subscriber: subscription.subscriber,
      plan_id: subscription.plan_id,
      start_time: subscription.start_time,
      billing_info: subscription.billing_info
    });

  } catch (err) {
    console.error("ERRO AO BUSCAR ASSINATURA:", err);
    return res.status(500).json({
      error: "Erro ao buscar assinatura",
      details: err.message
    });
  }
}

export async function cancelSubscription(req, res) {
  try {
    const { subscriptionId } = req.params;
    const { reason } = req.body;
    const token = await getAccessToken();

    const response = await fetch(
      `${process.env.PAYPAL_BASE_URL || 'https://api-m.paypal.com'}/v1/billing/subscriptions/${subscriptionId}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: reason || "Cancelamento solicitado pelo cliente"
        })
      }
    );

    if (response.status === 204) {
      console.log("✅ Assinatura cancelada:", subscriptionId);
      return res.json({
        success: true,
        message: "Assinatura cancelada com sucesso"
      });
    }

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({
        error: "Erro ao cancelar assinatura",
        details: data
      });
    }

    return res.json(data);

  } catch (err) {
    console.error("ERRO AO CANCELAR ASSINATURA:", err);
    return res.status(500).json({
      error: "Erro ao cancelar assinatura",
      details: err.message
    });
  }
}

export async function subscriptionSuccess(req, res) {
  try {
    const { subscription_id, ba_token } = req.query;

    console.log("✅ Assinatura aprovada! ID:", subscription_id);

    if (!subscription_id) {
      return res.status(400).send('ID de assinatura não fornecido');
    }

    const token = await getAccessToken();

    const response = await fetch(
      `${process.env.PAYPAL_BASE_URL || 'https://api-m.paypal.com'}/v1/billing/subscriptions/${subscription_id}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const subscription = await response.json();

    // Aqui você pode salvar no banco de dados
    console.log('Dados da assinatura:', {
      id: subscription.id,
      status: subscription.status,
      email: subscription.subscriber?.email_address,
      start_time: subscription.start_time
    });

    return res.redirect(`https://sitexpres.com.br/sucesso?subscription=${subscription_id}`);

  } catch (err) {
    console.error("ERRO AO PROCESSAR SUCESSO:", err);
    return res.status(500).send('Erro ao processar assinatura');
  }
}

export async function subscriptionCancel(req, res) {
  console.log('❌ Usuário cancelou a assinatura');
  return res.redirect('https://sitexpres.com.br/cancelado');
}

// ==================== WEBHOOKS ====================
export async function webhook(req, res) {
  const event = req.body;

  console.log("\n🔔 Webhook recebido:", event.event_type);
  console.log("Resource ID:", event.resource?.id);

  try {
    // Criar arquivo de log
    await saveWebhookLog(event);

    switch (event.event_type) {
      // Pagamento único
      case 'PAYMENT.CAPTURE.COMPLETED':
      case 'CHECKOUT.ORDER.APPROVED':
        const status = event.resource?.status || '';
        if (status.toUpperCase() === 'COMPLETED' || status.toUpperCase() === 'APPROVED') {
          await paymentSuccess(
            { query: { token: event.resource.id } },
            {
              redirect: (url) => console.log(`[Webhook] Redirecionamento simulado para: ${url}`),
              status: () => ({ send: () => { } }),
              send: () => { }
            }
          );
        }
        console.log('✅ Pagamento processado:', event.resource.id);
        break;

      case 'PAYMENT.CAPTURE.DENIED':
        console.log('❌ Pagamento negado');
        break;

      // Assinaturas
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        console.log('✅ Assinatura ativada:', event.resource.id);
        // Aqui: ativar acesso do usuário
        break;

      case 'BILLING.SUBSCRIPTION.CREATED':
        console.log('📝 Assinatura criada:', event.resource.id);
        break;

      case 'PAYMENT.SALE.COMPLETED':
        console.log('💰 Pagamento recorrente recebido:', event.resource.amount.total);
        // Aqui: renovar acesso do usuário
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
        console.log('❌ Assinatura cancelada:', event.resource.id);
        // Aqui: desativar acesso do usuário
        break;

      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        console.log('⏸️ Assinatura suspensa (pagamento falhou):', event.resource.id);
        // Aqui: notificar usuário sobre problema no pagamento
        break;

      case 'BILLING.SUBSCRIPTION.EXPIRED':
        console.log('⏰ Assinatura expirou:', event.resource.id);
        break;

      default:
        console.log('ℹ️ Evento não tratado:', event.event_type);
    }

    return res.sendStatus(200);

  } catch (err) {
    console.error("ERRO NO WEBHOOK:", err);
    return res.sendStatus(500);
  }
}

async function saveWebhookLog(event) {
  // Criar pasta de logs se não existir
  const logsDir = path.join(process.cwd(), 'webhook-logs');
  try {
    await fs.mkdir(logsDir, { recursive: true });
  } catch (err) {
    // Pasta já existe
  }

  // Gerar nome do arquivo com data e hora
  const now = new Date();
  const timestamp = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const filename = `webhook_${timestamp}.txt`;
  const filepath = path.join(logsDir, filename);

  // Formatar conteúdo do log
  const logContent = `
      =====================================
      WEBHOOK RECEBIDO
      =====================================
      Data/Hora: ${now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
      Timestamp: ${now.toISOString()}

      EVENTO: ${event.event_type}
      Resource ID: ${event.resource?.id || 'N/A'}

      DADOS COMPLETOS:
      ${JSON.stringify(event, null, 2)}
      =====================================
      `;

  // Salvar arquivo
  await fs.writeFile(filepath, logContent, 'utf8');
  console.log(`📄 Log salvo em: ${filepath}`);
}