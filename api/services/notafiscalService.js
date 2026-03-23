import fetch from "node-fetch";
import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export async function gerandonotafiscal(data) {
  try {
    const {
      valor_servico,
      cnpj_cpf,
      razao_social,
      endereco,
      bairro,
      cod_municipio,
      uf,
      cep,
      telefone,
      email
    } = data;

    // Valores padrões
    const CEP_PADRAO = "68553-170";
    const COD_MUNICIPIO_PADRAO = "1506138";

    // ---------------------------
    // 1. VALIDAR CEP NA VIA CEP
    // ---------------------------
    let cepFinal = CEP_PADRAO;
    let apenasNumeros = cep ? cep.replace(/\D/g, "") : "";

    if (apenasNumeros.length === 8) {
      const via = await fetch(`https://viacep.com.br/ws/${apenasNumeros}/json/`);
      const viaJson = await via.json();

      if (!viaJson.erro) {
        cepFinal = apenasNumeros;
      }
    }

    // ---------------------------
    // 2. VALIDAR MUNICÍPIO NO IBGE
    // ---------------------------
    let codMunicipioFinal = COD_MUNICIPIO_PADRAO;

    if (cod_municipio && /^[0-9]+$/.test(cod_municipio)) {
      const ibge = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${cod_municipio}`
      );

      if (ibge.status === 200) {
        const json = await ibge.json();
        if (json && json.id) {
          codMunicipioFinal = cod_municipio;
        }
      }
    }

    // ---------------------------
    // 3. MONTAR FORM-URLENCODED
    // ---------------------------
    const formData = new URLSearchParams();
    formData.append("valor_servico", valor_servico);
    formData.append("cnpj_cpf", cnpj_cpf);
    formData.append("razao_social", razao_social);
    formData.append("endereco", endereco);
    formData.append("bairro", bairro);
    formData.append("cod_municipio", codMunicipioFinal);
    formData.append("uf", uf);
    formData.append("cep", cepFinal);
    formData.append("telefone", telefone);
    formData.append("email", email);

    // ---------------------------
    // 4. ENVIAR PARA SUA API
    // ---------------------------
    const response = await fetch("https://sitexpres.com.br/notafiscal/index.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const retorno = await response.text();

    return {
      status: true,
      message: "NF enviada com sucesso",
      dados_enviados: formData,
      resposta_nf: retorno,
      municipio_usado: codMunicipioFinal,
      cep_usado: cepFinal
    };

  } catch (error) {
    return {
      status: false,
      message: "Erro ao gerar nota",
      error: error.message
    };
  }
}

// -----------------------------------------------------
// FUNÇÃO PARA EMISSÃO DE NOTA FISCAL NACIONAL (NFS-E)
// Comunica-se com o script PHP emitir_nota_gov.php
// -----------------------------------------------------
export async function gerarNotaNacional(data) {
  return new Promise(async (resolve, reject) => {
    try {
      const {
        valor_servico,
        cnpj_cpf,
        razao_social,
        endereco,
        bairro,
        cod_municipio,
        uf,
        cep,
        telefone,
        email,
        descricao
      } = data;

      // Limpar CNPJ/CPF
      const documentoNormalizado = cnpj_cpf ? cnpj_cpf.replace(/\D/g, "") : "";
      
      let tipoDoc = "CPF";
      if (documentoNormalizado.length === 14) tipoDoc = "CNPJ";
      
      const isForeign = (documentoNormalizado.length === 0 || uf === "EX" || cep === "00000000");
      if (isForeign) tipoDoc = "EXT";

      // Preparar JSON para o PHP
      const payload = {
        ambiente: process.env.NFSE_AMBIENTE || "Producao",
        prestador: {
          codigoMunicipio: process.env.NFSE_CODIGO_MUNICIPIO || "1506138", // Redenção
          cnpjPrestador: process.env.NFSE_CNPJ_PRESTADOR || "",
          inscricaoMunicipal: process.env.NFSE_INSCRICAO_MUNICIPAL || "",
          nomeFantasia: process.env.NFSE_NOME_FANTASIA || "Sitexpress",
          telefone: process.env.NFSE_TELEFONE || "",
          email: process.env.NFSE_EMAIL || "contato@sitexpres.com",
          optanteSimplesNacional: process.env.NFSE_OPTANTE_SN || 1, // 1 - Sim, 2 - Não...
          certificadoPath: process.env.NFSE_CERTIFICADO_PATH || path.join(__dirname, "../../certificados/certificado.pfx"),
          certificadoSenha: process.env.NFSE_CERTIFICADO_SENHA || ""
        },
        cliente: {
          isForeign: isForeign,
          pais: isForeign ? "US" : "BR",
          tipo: tipoDoc,
          cpfCnpj: documentoNormalizado,
          nome: razao_social || (isForeign ? "Consumidor Estrangeiro" : "Consumidor"),
          razaoSocial: razao_social || (isForeign ? "Consumidor Estrangeiro" : "Consumidor"),
          logradouro: endereco || (isForeign ? "Foreign Address" : "Não Informado"),
          numero: "S/N",
          bairro: bairro || (isForeign ? "Foreign District" : "Não Informado"),
          codigoMunicipio: isForeign ? "9999999" : (cod_municipio || "1506138"),
          cep: isForeign ? "" : (cep || "68553170"),
          email: email || ""
        },
        servico: {
          codigo_dps: Date.now().toString().substring(5), // identificador temporário para gerar único
          imposto_retido: process.env.NFSE_IMPOSTO_RETIDO || "nao",
          aliquota: process.env.NFSE_ALIQUOTA || 0,
          percentual_tributos_sn: process.env.NFSE_PERCENTUAL_SN || 0,
          codigoTributacao: process.env.NFSE_CODIGO_TRIBUTACAO || "01.07", // Ex: Suporte técnico
          descricao: descricao || "Serviço de Tecnologia e Software",
          valorServico: valor_servico
        }
      };

      // Chama o script PHP
      const scriptPath = path.join(__dirname, "../notafiscal_nacional/run_nfse.php");
      
      const child = exec(`php "${scriptPath}"`, (error, stdout, stderr) => {
        if (error) {
          console.error("Erro na execução do PHP NF Nacional:", error);
          console.error("Stderr NF Nacional:", stderr);
          return resolve({
            sucesso: false,
            mensagem: "Falha ao executar o emissor nacional",
            erro: error.message,
            stderr: stderr
          });
        }

        try {
          // O PHP deve retornar apenas JSON limpo no stdout
          const result = JSON.parse(stdout.trim());
          
          if (result.sucesso) {
            // A Nacional retorna a chave muitas vezes com o prefixo 'NFS' ou 'DPS'.
            // Removemos para que o cliente tenha apenas os 44 números que o portal aceita.
            let chaveLimpa = result.chaveAcesso || "";
            if (chaveLimpa.startsWith("NFS") || chaveLimpa.startsWith("DPS")) {
                chaveLimpa = chaveLimpa.substring(3);
            }

            resolve({
              sucesso: true,
              chaveAcesso: chaveLimpa,
              numeroNfse: result.numeroNfse,
              codigoVerificacao: result.codigoVerificacao,
              linkConsulta: "https://www.nfse.gov.br/consultapublica",
              mensagem: result.mensagem,
              dadosCompletos: result.dadosCompletos
            });
          } else {
            resolve({
              sucesso: false,
              mensagem: "Erro reportado pela API Nacional de NFS-e",
              erro: result.erro
            });
          }
        } catch (parseError) {
          console.error("Erro ao fazer parse da resposta do PHP:", stdout);
          resolve({
            sucesso: false,
            mensagem: "Erro ao processar resposta do emissor nacional",
            erro: parseError.message,
            rawOutput: stdout
          });
        }
      });

      // Passar JSON pelo stdin
      child.stdin.on('error', (err) => {
        console.log("Aviso: Falha ao escrever na entrada do PHP (EPIPE). O PHP fechou prematuramente.");
      });
      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();

    } catch (error) {
      resolve({
        sucesso: false,
        mensagem: "Erro interno no serviço NodeJS ao preparar nota",
        erro: error.message
      });
    }
  });
}

