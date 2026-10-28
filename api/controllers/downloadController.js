import fs from "fs";
import path from "path";
import pool from "../config/db.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const archiver = require("archiver");
import { desatrelarHtmlSitexpress, coletarArquivosProjeto } from "../utils/siteAssetHelper.js";

function getArchiverInstance() {
  if (archiver && archiver.ZipArchive) {
    return new archiver.ZipArchive({ zlib: { level: 9 } });
  } else if (archiver && archiver.default && archiver.default.ZipArchive) {
    return new archiver.default.ZipArchive({ zlib: { level: 9 } });
  } else if (typeof archiver === 'function') {
    return archiver('zip', { zlib: { level: 9 } });
  } else if (archiver && typeof archiver.create === 'function') {
    return archiver.create('zip', { zlib: { level: 9 } });
  } else if (archiver && typeof archiver.default === 'function') {
    return archiver.default('zip', { zlib: { level: 9 } });
  }
  throw new Error("Archiver não é suportado: " + typeof archiver);
}

export const downloadSite = async (req, res) => {
  const { id } = req.params;
  const tipo = (req.query.tipo || req.query.type || 'vps').toLowerCase(); // 'hospedagem' ou 'vps'

  try {
    // 1. Busca dados do site no banco
    const siteRes = await pool.query(
      `SELECT g.html_content, g.js_content, g.name, g.id_projeto, g.subdominio, s.metadata
       FROM generated_sites g
       LEFT JOIN (
         SELECT DISTINCT ON (id_projeto) id_projeto, metadata 
         FROM public.sites 
         ORDER BY id_projeto, id DESC
       ) s ON s.id_projeto = g.id_projeto
       WHERE g.id_projeto = $1 AND g.status = 'ativo' 
       ORDER BY g.created_at DESC LIMIT 1`,
      [id]
    );

    if (siteRes.rows.length === 0 || !siteRes.rows[0].html_content) {
      return res.status(404).json({ success: false, message: "Site não encontrado para download" });
    }

    const { html_content, js_content, name, subdominio } = siteRes.rows[0];
    let isPromax = false;
    if (siteRes.rows[0].metadata) {
      try {
        const meta = typeof siteRes.rows[0].metadata === 'string'
          ? JSON.parse(siteRes.rows[0].metadata)
          : siteRes.rows[0].metadata;
        isPromax = !!meta?.is_promax;
      } catch (e) {}
    }

    const safeName = (name || `site-${id}`).replace(/\s+/g, '-').toLowerCase();

    // ─────────────────────────────────────────────────────────────
    // CASO 1: HOSPEDAGEM COMPARTILHADA (DirectAdmin / cPanel)
    // ─────────────────────────────────────────────────────────────
    if (tipo === 'hospedagem') {
      if (isPromax) {
        return res.status(400).json({ 
          success: false, 
          message: "Sistemas Pro Max com banco de dados PostgreSQL rodam exclusivamente em VPS com Docker." 
        });
      }

      // Empacota o html_content sanitizado + todas as imagens (locais e remotas) + .htaccess
      res.attachment(`${safeName}-hospedagem.zip`);
      const archive = getArchiverInstance();
      archive.pipe(res);

      const html = desatrelarHtmlSitexpress(html_content);
      const arquivosExtras = await coletarArquivosProjeto(id, html, null, pool, subdominio);

      archive.append(html, { name: "index.html" });

      // .htaccess para DirectAdmin / cPanel não dar erro 404 em rotas internas do React
      const htaccessContent = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
`;
      archive.append(htaccessContent, { name: ".htaccess" });

      const readmeHospedagem = `ARQUIVOS PARA HOSPEDAGEM (DirectAdmin / cPanel / Apache / Nginx)
================================================================
1. Acesse o Gerenciador de Arquivos do DirectAdmin ou cPanel.
2. Abra a pasta "public_html" do seu domínio.
3. Envie este arquivo ZIP e descompacte (Extract).
4. Todas as imagens estão inclusas na pasta "images/".
5. Seu site estará funcionando imediatamente!
`;
      archive.append(readmeHospedagem, { name: "LEIA-ME-HOSPEDAGEM.txt" });

      if (Array.isArray(arquivosExtras)) {
        for (const arq of arquivosExtras) {
          if (arq.localPath) {
            archive.file(arq.localPath, { name: `images/${arq.remoteName}` });
          } else if (arq.buffer) {
            archive.append(arq.buffer, { name: `images/${arq.remoteName}` });
          }
        }
      }

      await archive.finalize();
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // CASO 2: VPS / DOCKER (Projeto Completo / Código Fonte)
    // ─────────────────────────────────────────────────────────────
    res.attachment(`${safeName}-vps-docker.zip`);
    const archive = getArchiverInstance();
    archive.pipe(res);

    // Se for PROMAX (Fullstack Node.js + PostgreSQL)
    let isPromaxFiles = false;
    if (js_content) {
      try {
        const parsedFiles = JSON.parse(js_content);
        if (Array.isArray(parsedFiles) && parsedFiles.length > 0 && parsedFiles[0].path) {
          isPromaxFiles = true;
          for (const file of parsedFiles) {
            if (file.encoding === 'base64') {
              archive.append(Buffer.from(file.content, 'base64'), { name: file.path });
            } else {
              archive.append(file.content, { name: file.path });
            }
          }

          const readmePromax = `SISTEMA FULLSTACK PROMAX (NODE.JS + POSTGRESQL + DOCKER)
=========================================================
1. Extraia estes arquivos na sua VPS.
2. Certifique-se de ter Docker e Docker Compose instalados.
3. Execute:
   docker compose up -d --build
4. Sua aplicação estará rodando com banco de dados PostgreSQL integrado!
`;
          archive.append(readmePromax, { name: "LEIA-ME-VPS.txt" });
        }
      } catch (e) {}
    }

    // Se não for Promax (é um projeto React / Vite)
    if (!isPromaxFiles) {
      const templatePath = path.join(process.cwd(), "templates", "vite-base");
      if (fs.existsSync(templatePath)) {
        archive.directory(templatePath, false, (entry) => {
          if (entry.name.startsWith("node_modules") || entry.name.startsWith("dist")) {
            return false;
          }
          return entry;
        });
      }

      if (js_content && !js_content.startsWith("[")) {
        archive.append(js_content, { name: "src/App.jsx" });
      }

      // Dockerfile pronto para VPS
      const dockerfileContent = `# Estágio 1: Build da aplicação React Vite
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# Estágio 2: Servidor Web Nginx ultra-leve
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
      archive.append(dockerfileContent, { name: "Dockerfile" });

      // docker-compose.yml pronto para VPS
      const composeContent = `version: '3.8'

services:
  site:
    build: .
    container_name: ${safeName}
    ports:
      - "80:80"
    restart: always
`;
      archive.append(composeContent, { name: "docker-compose.yml" });

      const readmeVps = `PROJETO REACT/VITE PARA VPS (DOCKER)
=====================================
COMO RODAR NA SUA VPS (VIA DOCKER):
1. Extraia este arquivo ZIP em qualquer pasta da sua VPS.
2. No terminal dentro da pasta, execute:
   docker compose up -d --build
3. O site estará no ar na porta 80!

COMO RODAR LOCALMENTE NO COMPUTADOR (DESENVOLVIMENTO):
1. Tenha o Node.js 18+ instalado.
2. Execute:
   npm install
   npm run dev
3. Acesse: http://localhost:5173
`;
      archive.append(readmeVps, { name: "LEIA-ME-VPS.txt" });

      const html = desatrelarHtmlSitexpress(html_content);
      const arquivosExtras = await coletarArquivosProjeto(id, html, null, pool, subdominio);
      if (Array.isArray(arquivosExtras)) {
        for (const arq of arquivosExtras) {
          if (arq.localPath) {
            archive.file(arq.localPath, { name: `public/images/${arq.remoteName}` });
          } else if (arq.buffer) {
            archive.append(arq.buffer, { name: `public/images/${arq.remoteName}` });
          }
        }
      }
    }

    await archive.finalize();

  } catch (err) {
    console.error("Erro no download:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Erro ao gerar arquivo para download" });
    }
  }
};
