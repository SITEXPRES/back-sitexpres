// integracao_directadmin.js
import axios from "axios";
import ftp from "basic-ftp";
import { Readable } from "stream";
import https from "https";
import dotenv from "dotenv";

dotenv.config();

// Função para criar conta no DirectAdmin
export async function criarSubdominioDirectAdmin(subdominio, dominioPrincipal) {
  try {
    const url = `https://srv3br.com.br:2222/CMD_API_SUBDOMAIN`;
    const params = new URLSearchParams({
      action: "create",
      domain: 'sitexpres.com.br',       // ex: sitexpres.com.br
      subdomain: subdominio
    });

    const response = await axios.post(url, params.toString(), {
      auth: {
        username: process.env.user_directamin, // seu usuário do DirectAdmin
        password: process.env.pass_directamin,
      },
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    return response.data;
  } catch (err) {
    console.error("Erro ao criar subdomínio:", err);
    throw err;
  }
}


export async function deletarSubdominioDirectAdmin(subdominio, dominioPrincipal = 'sitexpres.com.br') {
  try {
    const url = `https://srv3br.com.br:2222/CMD_API_SUBDOMAIN`;

    const params = new URLSearchParams({
      action: "delete",
      domain: dominioPrincipal,
      // AQUI ESTÁ O PULO DO GATO:
      select0: subdominio, // O DirectAdmin exige 'select0' para deletar, não 'subdomain'
      contents: "yes"      // Garante que a pasta e os arquivos sejam apagados também
    });

    const response = await axios.post(url, params.toString(), {
      auth: {
        username: process.env.user_directamin,
        password: process.env.pass_directamin,
      },
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    console.log("##==> Resposta do DirectAdmin (Delete):", response.data);

    return response.data; 
  } catch (err) {
    console.error("Erro ao deletar subdomínio:", err);
    throw err;
  }
}

import path from "path";

// Função para enviar o HTML gerado diretamente por string, incluindo imagens e assets se existirem
export async function enviarHTMLSubdominio(host, usuario, senha, subdominio, html, arquivosExtras = []) {
  if (!host || !usuario || !senha || !subdominio || !html) {
    throw new Error("Parâmetros inválidos para enviarHTMLSubdominio");
  }

  const client = new ftp.Client();
  client.ftp.verbose = true;

  try {
    // Conecta no FTP
    await client.access({ host, user: usuario, password: senha, secure: false });

    // Caminho remoto
    const remoteDir = `/domains/${subdominio}/public_html`;

    // Garante que o diretório exista
    await client.ensureDir(remoteDir);

    // Cria um stream a partir da string HTML
    const htmlStream = Readable.from([html]);

    // Envia o arquivo index.html
    await client.uploadFrom(htmlStream, `${remoteDir}/index.html`);

    // Envia o arquivo .htaccess para permitir roteamento SPA
    const htaccessContent = "<IfModule mod_rewrite.c>\n  RewriteEngine On\n  RewriteBase /\n  RewriteRule ^index\\.html$ - [L]\n  RewriteCond %{REQUEST_FILENAME} !-f\n  RewriteCond %{REQUEST_FILENAME} !-d\n  RewriteRule . /index.html [L]\n</IfModule>";
    const htaccessStream = Readable.from([htaccessContent]);
    await client.uploadFrom(htaccessStream, `${remoteDir}/.htaccess`);

    console.log(`✅ HTML e .htaccess enviados com sucesso para ${subdominio}!`);

    // Envia arquivos extras (como imagens, logos e assets) para desatrelar da Sitexpres
    if (Array.isArray(arquivosExtras) && arquivosExtras.length > 0) {
      console.log(`📁 Enviando ${arquivosExtras.length} arquivo(s) extra(s) para ${subdominio}...`);
      for (const item of arquivosExtras) {
        if (!item || !item.localPath) continue;
        try {
          const subDirName = item.remoteSubdir || "images";
          const targetDir = `${remoteDir}/${subDirName}`;
          await client.ensureDir(targetDir);

          const fileName = item.remoteName || path.basename(item.localPath);
          await client.uploadFrom(item.localPath, `${targetDir}/${fileName}`);
          console.log(`✅ Asset enviado via FTP: ${subDirName}/${fileName}`);
        } catch (fileErr) {
          console.error(`⚠️ Erro ao enviar asset (${item.localPath}):`, fileErr.message);
        }
      }
    }
  } catch (err) {
    console.error("❌ Erro ao enviar HTML:", err);
    throw err;
  } finally {
    client.close();
  }
}

// Nova Função: Enviar Diretório Inteiro (Vite build dist)
export async function enviarDiretorioSubdominio(host, usuario, senha, subdominio, dirPath) {
  if (!host || !usuario || !senha || !subdominio || !dirPath) {
    throw new Error("Parâmetros inválidos para enviarDiretorioSubdominio");
  }

  // Verifica se o distPath existe e lista os arquivos antes de enviar
  const { readdirSync, statSync, existsSync } = await import("fs");
  if (!existsSync(dirPath)) {
    throw new Error(`❌ [FTP] distPath não existe no servidor: ${dirPath}`);
  }
  const arquivosLocais = readdirSync(dirPath);
  console.log(`[FTP] 📂 distPath: ${dirPath}`);
  console.log(`[FTP] 📄 Arquivos no dist (${arquivosLocais.length}):`, arquivosLocais);

  const client = new ftp.Client();
  client.ftp.verbose = true; // Ativa logs detalhados do FTP

  try {
    // Conecta no FTP
    console.log(`[FTP] 🔌 Conectando em ${host} com usuário ${usuario}...`);
    await client.access({ host, user: usuario, password: senha, secure: false });
    console.log(`[FTP] ✅ Conexão FTP estabelecida`);

    // Caminho remoto
    const remoteDir = `/domains/${subdominio}/public_html`;
    console.log(`[FTP] 📁 Diretório remoto alvo: ${remoteDir}`);

    // Garante que o diretório exista
    await client.ensureDir(remoteDir);
    console.log(`[FTP] ✅ Diretório remoto garantido`);

    // Lista o que havia antes de limpar
    try {
      const listaAntes = await client.list();
      console.log(`[FTP] 📋 Arquivos remotos ANTES da limpeza (${listaAntes.length}):`, listaAntes.map(f => f.name));
    } catch (listErr) {
      console.warn(`[FTP] ⚠️ Não foi possível listar arquivos remotos antes:`, listErr.message);
    }

    // Limpa o diretório antes de fazer upload do novo
    // Preserva images/ (logos de deploys anteriores); o novo dist/images é mesclado por cima
    for (const item of await client.list()) {
      if (item.name === "." || item.name === "..") continue;
      if (item.isDirectory && item.name === "images") continue;
      if (item.isDirectory) await client.removeDir(item.name);
      else await client.remove(item.name);
    }
    console.log(`[FTP] 🧹 Diretório remoto limpo (images/ preservada)`);

    // Envia o diretório inteiro
    console.log(`[FTP] 📤 Iniciando upload de: ${dirPath}`);
    await client.uploadFromDir(dirPath);
    console.log(`[FTP] ✅ uploadFromDir concluído`);

    // Lista o que foi enviado para confirmar
    try {
      const listaDepois = await client.list();
      console.log(`[FTP] 📋 Arquivos remotos APÓS upload (${listaDepois.length}):`, listaDepois.map(f => f.name));
    } catch (listErr) {
      console.warn(`[FTP] ⚠️ Não foi possível listar arquivos remotos após upload:`, listErr.message);
    }

    // Envia o arquivo .htaccess para permitir roteamento no SPA
    const htaccessContent = "<IfModule mod_rewrite.c>\n  RewriteEngine On\n  RewriteBase /\n  RewriteRule ^index\\.html$ - [L]\n  RewriteCond %{REQUEST_FILENAME} !-f\n  RewriteCond %{REQUEST_FILENAME} !-d\n  RewriteRule . /index.html [L]\n</IfModule>";
    const htaccessStream = Readable.from([htaccessContent]);
    await client.uploadFrom(htaccessStream, `${remoteDir}/.htaccess`);

    console.log(`✅ Diretório e .htaccess enviados com sucesso para ${subdominio}!`);
  } catch (err) {
    console.error("❌ Erro ao enviar Diretório:", err);
    throw err;
  } finally {
    client.close();
  }
}

// Consulta de Subdominio 
export async function subdominioExiste(subdominio, dominioPrincipal, usuarioDono = 'sitexpres') {
  try {
    console.log("\n===============================");
    console.log("🔍 VERIFICAÇÃO DE SUBDOMÍNIO");
    console.log("===============================");
    console.log(`🔑 Usuário admin: ${process.env.user_directamin}`);
    console.log(`🌐 Domínio: ${dominioPrincipal}`);
    console.log(`👤 Dono do domínio: ${usuarioDono}`);
    console.log(`🧩 Subdomínio a verificar: ${subdominio}`);
    console.log("-------------------------------");

    // ✅ GET correto com action=list
    const url = `https://${process.env.host_directadmin}:2222/CMD_API_SUBDOMAINS?action=list&domain=${dominioPrincipal}&owner=${usuarioDono}`;

    const response = await axios.get(url, {
      auth: {
        username: process.env.user_directamin,
        password: process.env.pass_directamin,
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });

    console.log("📩 Resposta bruta do DirectAdmin:");
    console.log(response.data);

    // Extrai subdomínios retornados
    const matches = [...response.data.matchAll(/subdomain=([\w\d-]+)/g)];
    const subdominios = matches.map((m) => m[1]);

    console.log("\n📜 Subdomínios encontrados:");
    console.log(subdominios.length > 0 ? `✅ ${subdominios.join(", ")}` : "❌ Nenhum subdomínio encontrado");

    const existe = subdominios.includes(subdominio);

    console.log("\n📊 RESULTADO FINAL");
    console.log("-------------------------------");
    console.log(existe ? `✅ O subdomínio "${subdominio}" já existe!` : `🆕 O subdomínio "${subdominio}" ainda não existe.`);
    console.log("===============================\n");

    return existe;
  } catch (err) {
    console.error("\n❌ Erro ao verificar subdomínio:", err.message);
    if (err.response?.data) {
      console.error("🧾 Resposta do servidor:", err.response.data);
    }
    console.log("===============================\n");
    throw err;
  }
}

/**
 * Configura o Proxy Reverso no DirectAdmin apontando um subdomínio para uma porta na VPS Docker
 * @param {Object} params
 * @param {string} params.subdominio - ex: "meucrm"
 * @param {number|string} params.portaVps - ex: 13000
 * @param {string} [params.dominioPrincipal] - default: "sitexpres.com.br"
 * @param {string} [params.ipVps] - default: "143.208.9.235"
 */
export async function configurarProxySubdominio({
  subdominio,
  portaVps,
  dominioPrincipal = 'sitexpres.com.br',
  ipVps = '143.208.9.235'
}) {
  console.log(`[PROXY_DA] 🌐 Iniciando configuração de Proxy Reverso para ${subdominio}.${dominioPrincipal} -> ${ipVps}:${portaVps}`);

  // 1. Cria o subdomínio no DirectAdmin (se já existir, o DA apenas mantém)
  try {
    await criarSubdominioDirectAdmin(subdominio, dominioPrincipal);
    console.log(`[PROXY_DA] ✅ Subdomínio ${subdominio} garantido no DirectAdmin`);
  } catch (daErr) {
    console.warn(`[PROXY_DA] ⚠️ Aviso ao criar subdomínio no DirectAdmin (pode já existir):`, daErr.message);
  }

  // 2. Monta o .htaccess com regras de Proxy Reverso (mod_rewrite / mod_proxy)
  const htaccessContent = `# ========================================================
# PROXY REVERSO SITEXPRESS PROMAX
# Encaminha o tráfego do subdomínio para a aplicação Docker
# ========================================================
RewriteEngine On
RewriteBase /

# 1. Se o mod_proxy estiver ativo, faz proxy transparente mantendo a URL e SSL
<IfModule mod_proxy.c>
  ProxyPreserveHost On
  ProxyPass / http://${ipVps}:${portaVps}/
  ProxyPassReverse / http://${ipVps}:${portaVps}/
</IfModule>

# 2. Fallback via RewriteRule com flag [P] (Proxy)
<IfModule mod_rewrite.c>
  RewriteRule ^(.*)$ http://${ipVps}:${portaVps}/$1 [P,L]
</IfModule>
`;

  // 3. Monta o index.html com Iframe Fullscreen de fallback caso mod_proxy não esteja liberado
  const indexHtmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subdominio}.${dominioPrincipal}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #020617; }
    iframe { border: none; width: 100%; height: 100%; display: block; }
  </style>
</head>
<body>
  <iframe src="http://${ipVps}:${portaVps}/" title="${subdominio}"></iframe>
</body>
</html>`;

  // 4. Conecta via FTP e grava o .htaccess e o index.html na pasta do subdomínio
  const client = new ftp.Client();
  client.ftp.verbose = false;

  const ftpHosts = ["ftp.sitexpres.com.br", "srv3br.com.br"];
  let uploaded = false;
  let lastError = null;

  const targetDir = `/domains/${subdominio}.${dominioPrincipal}/public_html`;

  for (const host of ftpHosts) {
    try {
      console.log(`[PROXY_DA] 🔌 Conectando via FTP em ${host}...`);
      await client.access({
        host,
        user: process.env.user_directamin,
        password: process.env.pass_directamin,
        secure: false
      });

      console.log(`[PROXY_DA] 📁 Acessando diretório alvo: ${targetDir}`);
      await client.ensureDir(targetDir);

      // Envia .htaccess
      const htaccessStream = Readable.from([htaccessContent]);
      await client.uploadFrom(htaccessStream, `${targetDir}/.htaccess`);
      console.log(`[PROXY_DA] ✅ .htaccess de Proxy Reverso gravado com sucesso!`);

      // Envia index.html de fallback
      const indexStream = Readable.from([indexHtmlContent]);
      await client.uploadFrom(indexStream, `${targetDir}/index.html`);
      console.log(`[PROXY_DA] ✅ index.html de fallback gravado com sucesso!`);

      uploaded = true;
      break;
    } catch (ftpErr) {
      console.warn(`[PROXY_DA] ⚠️ Falha ao enviar via FTP em ${host}:`, ftpErr.message);
      lastError = ftpErr;
    } finally {
      client.close();
    }
  }

  if (!uploaded) {
    throw new Error(`Não foi possível enviar configuração de proxy via FTP para o DirectAdmin: ${lastError?.message}`);
  }

  const urlFinal = `https://${subdominio}.${dominioPrincipal}`;
  console.log(`[PROXY_DA] 🎉 Proxy configurado com sucesso! Subdomínio ativo em: ${urlFinal}`);

  return {
    success: true,
    subdominio: `${subdominio}.${dominioPrincipal}`,
    url: urlFinal,
    alvoVps: `http://${ipVps}:${portaVps}`
  };
}
