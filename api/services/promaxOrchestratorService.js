import dotenv from "dotenv";
import { gerarAplicacaoPromax } from "./promaxService.js";
import { configurarProxySubdominio } from "../controllers/integracao_directadmin.js";

dotenv.config();

const VPS_HOST = process.env.VPS_DEPLOY_HOST || 'http://143.208.9.235:9001';
const VPS_TOKEN = process.env.VPS_DEPLOY_TOKEN || '@#token3226@#api';

/**
 * 1. Provisiona o Banco de Dados PostgreSQL na VPS
 */
export async function provisionDatabaseOnVPS(projectName, dbUser, dbPass) {
  console.log(`[MAESTRO] 🐘 Solicitando criação de Banco de Dados na VPS: ${projectName}...`);
  
  const res = await fetch(`${VPS_HOST}/api/v1/deploy/database`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VPS_TOKEN}`
    },
    body: JSON.stringify({
      projectName,
      dbUser,
      dbPass
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Falha ao provisionar Banco de Dados na VPS (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  console.log(`[MAESTRO] ✅ Banco de Dados criado na VPS! Container: ${data.container} | Porta Externa: ${data.externalPort}`);
  return data;
}

/**
 * 2. Faz o Deploy dos arquivos da Aplicação na VPS via JSON
 */
export async function deployAppOnVPS(name_app, tecnologia, files, env) {
  console.log(`[MAESTRO] 🚀 Solicitando subida do Container da Aplicação na VPS: ${name_app}...`);
  
  const res = await fetch(`${VPS_HOST}/api/v1/deploy/app`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VPS_TOKEN}`
    },
    body: JSON.stringify({
      name_app,
      tecnologia: tecnologia || 'node',
      files,
      env
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Falha ao fazer deploy da aplicação na VPS (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  console.log(`[MAESTRO] ✅ Container da Aplicação online na VPS! Container: ${data.container} | Porta: ${data.port}`);
  return data;
}

/**
 * 3. O MAESTRO: Orquestração completa de ponta a ponta
 * @param {Object} params
 * @param {string} params.prompt - O pedido do usuário (ex: "Gere um CRM de vendas")
 * @param {string} params.id_projeto - ID único do projeto
 * @param {number|string} params.userId - ID do usuário
 * @param {boolean} [params.mockCode] - Permite passar código pré-gerado para teste rápido
 */
export async function executarFluxoPromax({ prompt, id_projeto, userId, mockCode = null, existingMetadata = null }) {
  const startTime = Date.now();
  console.log(`\n================================================================`);
  console.log(`🎼 [MAESTRO] INICIANDO ORQUESTRAÇÃO PROMAX | Projeto: ${id_projeto}`);
  console.log(`================================================================\n`);

  // PASSO 1: Geração de Código pela IA (ou uso de mock para teste)
  let appData;
  if (mockCode) {
    console.log(`[MAESTRO] 🧪 Usando código fornecido (modo teste)...`);
    appData = mockCode;
  } else {
    console.log(`[MAESTRO] 🧠 Solicitando código à IA Claude...`);
    appData = await gerarAplicacaoPromax(prompt);
  }

  const sanitizedSlug = (appData.name_app || 'crm_app').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const uniqueProjectName = existingMetadata?.projectName || `${sanitizedSlug}_${id_projeto || Math.floor(Math.random() * 1000)}`;

  // PASSO 2: Provisionamento do Banco de Dados (ou reuso do banco existente)
  let dbResult;
  if (existingMetadata?.database) {
    console.log(`[MAESTRO] ♻️ Reutilizando banco de dados existente: ${existingMetadata.database.name}`);
    dbResult = {
      container: existingMetadata.containers?.db || `sitexpress-${uniqueProjectName}-db`,
      internalHost: existingMetadata.containers?.db || `sitexpress-${uniqueProjectName}-db`,
      internalPort: 5432,
      externalPort: existingMetadata.database.port_externa || existingMetadata.database.porta_externa,
      dbUser: existingMetadata.database.user,
      dbPass: existingMetadata.database.password,
      dbName: existingMetadata.database.name
    };
  } else {
    const dbUser = `usr_${Math.floor(Math.random() * 9000 + 1000)}`;
    const dbPass = `pwd_${Math.random().toString(36).substring(2, 12)}`;
    dbResult = await provisionDatabaseOnVPS(uniqueProjectName, dbUser, dbPass);
  }

  // PASSO 3: Injeção de Variáveis de Ambiente (.env) para conexão interna
  const appEnv = {
    PORT: 3000,
    NODE_ENV: 'production',
    DB_HOST: dbResult.internalHost,
    DB_PORT: dbResult.internalPort || 5432,
    DB_USER: dbResult.dbUser,
    DB_PASS: dbResult.dbPass,
    DB_NAME: dbResult.dbName,
    DATABASE_URL: `postgres://${dbResult.dbUser}:${dbResult.dbPass}@${dbResult.internalHost}:${dbResult.internalPort || 5432}/${dbResult.dbName}`
  };

  // PASSO 4: Deploy da Aplicação no Docker
  const appResult = await deployAppOnVPS(uniqueProjectName, appData.tecnologia || 'node', appData.files, appEnv);

  // PASSO 5: Configuração de Subdomínio e Proxy Reverso no DirectAdmin
  let proxyResult = null;
  const subdominioLimpo = (existingMetadata?.projectName || `${sanitizedSlug}-${id_projeto || Math.floor(Math.random() * 1000)}`)
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase()
    .slice(0, 28);

  try {
    console.log(`[MAESTRO] 🌐 Configurando Proxy Reverso no DirectAdmin: ${subdominioLimpo}.sitexpres.com.br...`);
    proxyResult = await configurarProxySubdominio({
      subdominio: subdominioLimpo,
      portaVps: appResult.port,
      dominioPrincipal: 'sitexpres.com.br',
      ipVps: '143.208.9.235'
    });
  } catch (proxyError) {
    console.warn(`[MAESTRO] ⚠️ Falha na configuração do proxy DirectAdmin (a URL direta da VPS permanece funcional):`, proxyError.message);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n================================================================`);
  console.log(`🎉 [MAESTRO] FLUXO PROMAX CONCLUÍDO COM SUCESSO EM ${durationSec}s!`);
  if (proxyResult?.url) {
    console.log(`🌐 Subdomínio Oficial: ${proxyResult.url}`);
  }
  console.log(`🌐 Acesso Direto VPS: http://143.208.9.235:${appResult.port}`);
  console.log(`================================================================\n`);

  return {
    success: true,
    tempoTotalSegundos: durationSec,
    projectName: uniqueProjectName,
    url_dominio: proxyResult?.url || existingMetadata?.url_dominio || null,
    url_direta: `http://143.208.9.235:${appResult.port}`,
    port: appResult.port,
    container_app: appResult.container,
    container_db: dbResult.container,
    db: {
      host: '143.208.9.235',
      internal_host: dbResult.internalHost,
      port_externa: dbResult.externalPort,
      name: dbResult.dbName,
      user: dbResult.dbUser,
      password: dbResult.dbPass,
      internal_url: `postgres://${dbResult.dbUser}:${dbResult.dbPass}@${dbResult.internalHost}:${dbResult.internalPort || 5432}/${dbResult.dbName}`
    },
    descricao: appData.descricao || '',
    tecnologia: appData.tecnologia || 'Node.js 18 + Express + PostgreSQL 15 + Tailwind CSS',
    files: appData.files ? appData.files.map(f => f.path) : []
  };
}
