// api/services/webalizerService.js
import ftp from 'basic-ftp';
import fs from 'fs';
import * as cheerio from 'cheerio';
import 'dotenv/config';

/**
 * Faz o parse do HTML gerado pelo Webalizer e extrai métricas.
 */
function parseWebalizerHtml(html) {
  const $ = cheerio.load(html);
  const text = $('body').text();

  const visits = text.match(/Total Visits\s+(\d+)/);
  const hits   = text.match(/Total Hits\s+(\d+)/);
  const files  = text.match(/Total Files\s+(\d+)/);

  return {
    visits: visits ? Number(visits[1]) : 0,
    hits:   hits   ? Number(hits[1])   : 0,
    files:  files  ? Number(files[1])  : 0,
  };
}

/** Retorna chave YYYYMM da data atual */
function mesAtual() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}

/**
 * Conecta ao FTP do cPanel usando as credenciais do usuário da hospedagem
 * e coleta os arquivos usage_YYYYMM.html gerados pelo Webalizer.
 *
 * @param {string} username  - Login FTP do usuário (campo `username` em hospedagens)
 * @param {string} domain    - Domínio do site (campo `dominio` em hospedagens)
 * @param {string} password  - Senha FTP (campo `senha` em hospedagens)
 * @returns {Record<string, {visits, hits, files}>} - Chave = YYYYMM, valor = métricas
 */
export async function getStatsFromFTP(username, domain, password) {
  const client = new ftp.Client();
  client.ftp.verbose = false;
  client.ftp.timeout = 15000; // 15s

  const ftpConfig = {
    host:     process.env.FTP_HOST || 'srv3br.com.br',
    user:     username,  // vem da tabela hospedagens
    password: password,  // vem da tabela hospedagens
    secure:   false,
    port:     21,
  };

  try {
    await client.access(ftpConfig);

    // Caminhos comuns do Webalizer no cPanel/DirectAdmin
    const candidatePaths = [
      `/home/${username}/tmp/webalizer`,
      `/home/${username}/stats`,
      `/domains/${domain}/stats`,
    ];

    let allFiles = [];
    let basePath = '';

    for (const path of candidatePaths) {
      try {
        const list = await client.list(path);
        const names = list.map(f => f.name);

        console.log(`📂 [${domain}] Listando ${path}: ${names.join(', ') || '(vazio)'}`);

        const found = names.filter(name => name.startsWith('usage_') && name.endsWith('.html'));

        if (found.length > 0) {
          allFiles = found;
          basePath = path;
          break;
        }
      } catch {
        // caminho não existe, tenta o próximo
      }
    }

    if (allFiles.length === 0) {
      console.warn(`⚠️  Nenhum arquivo de stats encontrado para ${domain} (user: ${username})`);
      return {};
    }

    console.log(`📊 [${domain}] Arquivos encontrados em ${basePath}: ${allFiles.join(', ')}`);

    const result = {};

    // ── Processa arquivos usage_YYYYMM.html ─────────────────────────────────
    for (const file of allFiles) {
      const remotePath = `${basePath}/${file}`;
      const localPath  = `/tmp/${username}_${file}`;

      try {
        await client.downloadTo(localPath, remotePath);

        const html  = fs.readFileSync(localPath, 'utf-8');
        const stats = parseWebalizerHtml(html);
        const date  = file.replace('usage_', '').replace('.html', ''); // YYYYMM

        result[date] = stats;
        console.log(`  ✅ ${file} → visits=${stats.visits}, hits=${stats.hits}, files=${stats.files}`);

      } catch (fileErr) {
        console.error(`❌ Erro ao processar ${file} de ${domain}:`, fileErr.message);
      } finally {
        if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
      }
    }

    // ── Mês corrente: Webalizer pode gerar index.html ao invés de usage_YYYYMM.html ──
    const chaveAtual = mesAtual(); // ex: "202603"
    if (!result[chaveAtual]) {
      const indexRemote = `${basePath}/index.html`;
      const indexLocal  = `/tmp/${username}_webalizer_index.html`;

      try {
        await client.downloadTo(indexLocal, indexRemote);
        const html  = fs.readFileSync(indexLocal, 'utf-8');
        const stats = parseWebalizerHtml(html);

        if (stats.hits > 0 || stats.visits > 0) {
          result[chaveAtual] = stats;
          console.log(`  ✅ index.html (mês atual ${chaveAtual}) → visits=${stats.visits}, hits=${stats.hits}`);
        } else {
          console.log(`  ℹ️  index.html do mês atual sem dados ainda (${chaveAtual})`);
        }
      } catch {
        // index.html não existe ou não tem dados — normal no início do mês
      } finally {
        if (fs.existsSync(indexLocal)) fs.unlinkSync(indexLocal);
      }
    }

    return result;

  } catch (err) {
    console.error(`❌ Erro FTP para ${domain} (user: ${username}):`, err.message);
    return {};
  } finally {
    client.close();
  }
}
