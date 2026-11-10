import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Diretório de logs para auditoria das operações de registro
const LOGS_DIR = path.resolve(__dirname, '../../webhook-logs');
const LOG_FILE = path.join(LOGS_DIR, 'registrobr.log');

// Assegura existência da pasta de logs
try {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
} catch (e) {
  console.error('[REGISTRO.BR] Falha ao verificar/criar diretório de logs:', e.message);
}

/**
 * Função utilitária para registrar logs físicos e no console
 */
function logOperacao(acao, payload, resultado, erro = null, tempoMs = 0) {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    acao,
    tempoMs: `${tempoMs}ms`,
    payload: { ...payload },
    resultado,
    erro: erro ? (erro.response?.data || erro.message || erro) : null
  };

  const logLinha = `[${timestamp}] [${acao}] [${tempoMs}ms] ${resultado?.success ? '✅ SUCESSO' : '❌ FALHA'}: ${JSON.stringify(logData)}\n`;

  console.log(`[REGISTRO.BR CLOUX] ${acao}:`, resultado?.success ? '✅ SUCESSO' : '❌ FALHA', resultado?.message || erro?.message || '');

  try {
    fs.appendFileSync(LOG_FILE, logLinha, 'utf8');
  } catch (fsErr) {
    console.error('[REGISTRO.BR] Erro ao gravar log em arquivo:', fsErr.message);
  }
}

/**
 * Normaliza e sanitiza um domínio
 */
export function normalizarDominio(dominio) {
  if (!dominio) return '';
  let limpo = String(dominio).trim().toLowerCase();
  limpo = limpo.replace(/^https?:\/\//i, '');
  limpo = limpo.replace(/\/+$/, '');
  return limpo;
}

/**
 * Verifica se um domínio é de extensão .br
 */
export function isDominioBr(dominio) {
  const limpo = normalizarDominio(dominio);
  return limpo.endsWith('.br');
}

/**
 * Normaliza a data para formato YYYY-MM-DD
 */
export function normalizarDataNascimento(dataRaw) {
  if (!dataRaw) return null;
  const str = String(dataRaw).trim();

  // Se já estiver YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Se for DD/MM/YYYY ou DD-MM-YYYY
  const partes = str.split(/[\/\-]/);
  if (partes.length === 3) {
    if (partes[0].length === 4) {
      // YYYY/MM/DD
      return `${partes[0]}-${partes[1].padStart(2, '0')}-${partes[2].padStart(2, '0')}`;
    }
    // DD/MM/YYYY -> YYYY-MM-DD
    return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
  }

  return str;
}

/**
 * Extrai número do logradouro se não fornecido separadamente
 */
export function extrairNumeroEndereco(endereco, numeroFornecido) {
  if (numeroFornecido && String(numeroFornecido).trim() !== '') {
    return String(numeroFornecido).trim();
  }

  if (!endereco) return 'SN';

  // Procura padrões como "Rua Tal, 123" ou "Avenida X, nº 45"
  const match = String(endereco).match(/[,|\-]\s*(?:n[ºo°]?\s*)?(\d+[a-zA-Z]?|sn|s\/n)\b/i);
  if (match) {
    return match[1].toUpperCase() === 'S/N' ? 'SN' : match[1];
  }

  return 'SN';
}

/**
 * Obtém e sanitiza a URL base da API do Registro.br / Cloudx
 */
export function getRegistroBrApiUrl() {
  let url = (process.env.REGISTROBR_API_URL || 'https://painel.cloudx.com.br/registrabr/api').trim();
  // Auto-correção para erros de digitação comuns (ex: cloux -> cloudx)
  url = url.replace(/painel\.cloux\.com\.br/gi, 'painel.cloudx.com.br');
  url = url.replace(/cloux\.com\.br/gi, 'cloudx.com.br');
  return url.replace(/\/+$/, '');
}

/**
 * 🌐 Rota 1: Consulta de Disponibilidade (100% Grátis)
 * URL: https://painel.cloudx.com.br/registrabr/api/consultar.php
 */
export async function consultarDisponibilidadeBr(dominio) {
  const inicio = Date.now();
  const dominioFormatado = normalizarDominio(dominio);

  const baseUrl = getRegistroBrApiUrl();
  const token = process.env.REGISTROBR_API_TOKEN || 'sitexpress_sec_token_9f83b2a7e4c1d682490ac9e';

  const url = `${baseUrl}/consultar.php`;

  try {
    const response = await axios.get(url, {
      params: { dominio: dominioFormatado },
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    const tempoMs = Date.now() - inicio;
    logOperacao('CONSULTAR_DISPONIBILIDADE', { dominio: dominioFormatado }, response.data, null, tempoMs);

    return response.data;
  } catch (error) {
    console.warn(`[REGISTRO.BR] Falha na API Cloudx (${error.message}). Tentando consulta direta no Registro.br...`);

    // Fallback de alta disponibilidade: consulta direta oficial do Registro.br
    try {
      const fbInicio = Date.now();
      const fbResp = await axios.get(`https://registro.br/v2/ajax/avail/raw/${dominioFormatado}`, {
        timeout: 8000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });

      const fbData = fbResp.data;
      // status: 0 = disponível, 2 = registrado, 1 = em processo de liberação, 3 = inválido/reservado
      const disponivel = fbData?.status === 0;

      const resultadoFallback = {
        success: true,
        code: 200,
        dominio: dominioFormatado,
        disponivel: disponivel,
        message: disponivel
          ? `O domínio ${dominioFormatado} está disponível para registro.`
          : `O domínio ${dominioFormatado} já se encontra registrado ou não está disponível.`,
        origem: 'registro.br (fallback direto)',
        raw: fbData
      };

      const tempoMs = Date.now() - fbInicio;
      logOperacao('CONSULTAR_DISPONIBILIDADE_FALLBACK', { dominio: dominioFormatado }, resultadoFallback, null, tempoMs);
      return resultadoFallback;
    } catch (fallbackErr) {
      const tempoMs = Date.now() - inicio;
      const erroData = error.response ? error.response.data : { message: error.message };
      logOperacao('CONSULTAR_DISPONIBILIDADE', { dominio: dominioFormatado }, erroData, error, tempoMs);

      return {
        success: false,
        code: error.response?.status || 500,
        dominio: dominioFormatado,
        disponivel: false,
        error: erroData.error || erroData.message || 'Falha ao consultar disponibilidade no Registro.br'
      };
    }
  }
}

/**
 * 🚀 Rota 2: Registro de Domínio via API Registro.br / Cloux
 * URL: https://painel.cloudx.com.br/registrabr/api/registrar.php
 */
export async function registrarDominioBr(dados) {
  const inicio = Date.now();

  const baseUrl = getRegistroBrApiUrl();
  const token = process.env.REGISTROBR_API_TOKEN || 'sitexpress_sec_token_9f83b2a7e4c1d682490ac9e';
  const url = `${baseUrl}/registrar.php`;

  const dominioFormatado = normalizarDominio(dados.dominio || dados.full_domain);

  // Limpa caracteres especiais do documento
  const docLimpo = String(dados.cpf_cnpj || dados.cpf || dados.cnpj || dados.customer_cpf || '').replace(/\D/g, '');
  const tipoPessoa = docLimpo.length === 14 ? 'juridica' : 'fisica';

  // Trata data de nascimento
  const dataNascimento = normalizarDataNascimento(
    dados.data_nascimento || dados.customer_birthdate || dados.birthdate || null
  );

  // Trata telefone: apenas dígitos numéricos
  const telefoneLimpo = String(dados.telefone || dados.customer_phone || '').replace(/\D/g, '');

  // Trata CEP: apenas 8 dígitos
  const cepLimpo = String(dados.cep || dados.customer_zipcode || '').replace(/\D/g, '');

  // Endereço e número
  const endereco = String(dados.endereco || dados.customer_address || '').trim();
  const numero = extrairNumeroEndereco(endereco, dados.numero || dados.customer_number);

  // Bairro: fallback para 'Centro' se vazio
  const bairro = String(dados.bairro || dados.customer_bairro || dados.customer_neighborhood || 'Centro').trim() || 'Centro';

  // Cidade e UF
  const cidade = String(dados.cidade || dados.customer_city || '').trim();
  const estado = String(dados.estado || dados.uf || dados.customer_state || 'SP').trim().toUpperCase().substring(0, 2);

  // Nameservers padrão
  const ns1 = dados.ns1 || process.env.REGISTROBR_NS1 || 'ns1.sitexpress.com.br';
  const ns2 = dados.ns2 || process.env.REGISTROBR_NS2 || 'ns2.sitexpress.com.br';

  const dryRun = Boolean(
    dados.dry_run ?? (process.env.REGISTROBR_DRY_RUN === 'true' || process.env.REGISTROBR_DRY_RUN === '1')
  );

  const payload = {
    dominio: dominioFormatado,
    ns1,
    ns2,
    cpf_cnpj: docLimpo,
    nome: String(dados.nome || dados.customer_name || '').trim(),
    email: String(dados.email || dados.customer_email || '').trim().toLowerCase(),
    telefone: telefoneLimpo,
    endereco: endereco || 'Rua Principal',
    numero: numero || 'SN',
    complemento: dados.complemento || dados.customer_complement || '',
    bairro: bairro,
    cidade: cidade || 'Sao Paulo',
    estado: estado || 'SP',
    cep: cepLimpo || '01001000',
    dry_run: dryRun
  };

  // Se for pessoa física (CPF), anexa data de nascimento
  if (tipoPessoa === 'fisica' && dataNascimento) {
    payload.data_nascimento = dataNascimento;
  } else if (dataNascimento) {
    payload.data_nascimento = dataNascimento;
  }

  try {
    console.log(`[REGISTRO.BR CLOUX] Enviando requisição de registro para ${dominioFormatado}...`);

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 35000 // Registro EPP pode levar alguns segundos
    });

    const tempoMs = Date.now() - inicio;
    logOperacao('REGISTRAR_DOMINIO', payload, response.data, null, tempoMs);

    const isSuccess = Boolean(response.data?.success);

    return {
      success: isSuccess,
      code: response.data?.code || response.status,
      data: response.data,
      dominio: dominioFormatado,
      ticket: response.data?.ticket || null,
      error: !isSuccess ? (response.data?.error || response.data?.message || 'Falha no registro do Registro.br') : null,
      erros: response.data?.erros || null,
      message: response.data?.message || (isSuccess ? 'Domínio registrado com sucesso no Registro.br!' : 'Falha ao registrar domínio no Registro.br')
    };
  } catch (error) {
    const tempoMs = Date.now() - inicio;
    const erroData = error.response ? error.response.data : { message: error.message };

    logOperacao('REGISTRAR_DOMINIO', payload, erroData, error, tempoMs);

    console.error(`[REGISTRO.BR CLOUX] Erro ao registrar domínio ${dominioFormatado}:`, erroData);

    return {
      success: false,
      code: error.response?.status || 500,
      dominio: dominioFormatado,
      error: erroData.error || erroData.message || error.message,
      erros: erroData.erros || null,
      payloadEnviado: payload
    };
  }
}

/**
 * 🔍 Função para testar a conectividade e integridade do Painel Cloudx / Registro.br
 */
export async function testarConexaoPainel() {
  const inicio = Date.now();
  const baseUrl = getRegistroBrApiUrl();
  const token = process.env.REGISTROBR_API_TOKEN || 'sitexpress_sec_token_9f83b2a7e4c1d682490ac9e';

  try {
    const response = await axios.get(`${baseUrl}/consultar.php`, {
      params: { dominio: 'sitexpress.com.br' },
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    const tempoMs = Date.now() - inicio;

    return {
      sucesso: true,
      mensagem: "Conexão com o painel Registro.br (Cloudx) realizada com sucesso!",
      url: baseUrl,
      tempoResposta: `${tempoMs}ms`,
      statusHttp: response.status,
      dadosResposta: response.data
    };
  } catch (error) {
    const tempoMs = Date.now() - inicio;
    return {
      sucesso: false,
      mensagem: `Falha na conexão com o painel: ${error.message}`,
      url: baseUrl,
      tempoResposta: `${tempoMs}ms`,
      statusHttp: error.response?.status || 500,
      erro: error.response?.data || error.message
    };
  }
}

export default {
  consultarDisponibilidadeBr,
  registrarDominioBr,
  testarConexaoPainel,
  getRegistroBrApiUrl,
  isDominioBr,
  normalizarDominio,
  normalizarDataNascimento,
  extrairNumeroEndereco
};
