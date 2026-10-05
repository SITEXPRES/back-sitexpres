/**
 * Site Optimizer - SitExpress
 *
 * Uso (na raiz do projeto):
 *   node tools/site-optimizer.js export  [id]   -> baixa o site para tools/output/site-<id>/ (+ backup)
 *   node tools/site-optimizer.js analyze [id]   -> mostra o que está pesando (SVGs, strings, linhas grandes)
 *   node tools/site-optimizer.js optimize [id]  -> gera js_content.optimized.js (dedup de classNames, limpeza)
 *   node tools/site-optimizer.js apply   [id]   -> envia tools/output/site-<id>/js_content.optimized.js para o banco
 *   node tools/site-optimizer.js restore [id]   -> restaura o backup original no banco
 *
 * Padrão de id: 29 (Thiago - sugestodesubdom)
 * Credenciais lidas de api/.env (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT) com fallback.
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', 'api', '.env');
const env = {};
if (fs.existsSync(envPath)) {
  for (const l of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const pool = new pg.Pool({
  user: env.DB_USER || 'adminsitexpress',
  host: env.DB_HOST || '143.208.9.218',
  database: env.DB_NAME || 'db_sitexpress',
  password: env.DB_PASSWORD || '@#sitex2025#new',
  port: Number(env.DB_PORT || 5432),
});

const [cmd = 'analyze', idArg = '29'] = process.argv.slice(2);
const id = Number(idArg);
const dir = path.join(__dirname, 'output', `site-${id}`);
const f = (n) => path.join(dir, n);

async function getSite() {
  const r = await pool.query('SELECT id, name, html_content, js_content FROM generated_sites WHERE id=$1', [id]);
  if (!r.rows.length) throw new Error(`Site ${id} não encontrado`);
  return r.rows[0];
}

async function exportSite() {
  const s = await getSite();
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(f('js_content.backup.js'))) {
    fs.writeFileSync(f('js_content.backup.js'), s.js_content || '');
    fs.writeFileSync(f('html_content.backup.html'), s.html_content || '');
    console.log('Backup criado.');
  } else console.log('Backup já existe (mantido).');
  fs.writeFileSync(f('js_content.js'), s.js_content || '');
  fs.writeFileSync(f('html_content.html'), s.html_content || '');
  console.log(`Exportado em ${dir}`);
  console.log(`JS: ${(s.js_content || '').length} chars | HTML: ${(s.html_content || '').length} chars`);
}

function analyze(code) {
  const total = code.length;
  const pct = (n) => ((n / total) * 100).toFixed(1) + '%';
  const svgs = code.match(/<svg[\s\S]*?<\/svg>/g) || [];
  const svgChars = svgs.reduce((a, b) => a + b.length, 0);
  const paths = code.match(/\sd="[^"]{200,}"/g) || [];
  const dupes = {};
  svgs.forEach((s) => (dupes[s] = (dupes[s] || 0) + 1));
  const dupCount = Object.values(dupes).filter((c) => c > 1).length;
  const strings = (code.match(/(["'`])(?:(?!\1)[^\\]|\\.){300,}\1/g) || []).sort((a, b) => b.length - a.length);
  const lines = code.split('\n').map((t, i) => ({ i: i + 1, len: t.length })).sort((a, b) => b.len - a.len).slice(0, 5);
  const dataUri = (code.match(/data:[a-z/+-]+;base64,[A-Za-z0-9+/=]+/g) || []).reduce((a, b) => a + b.length, 0);

  console.log(`Total: ${total} chars (~${Math.round(total / 3.5)} tokens)`);
  console.log(`SVGs inline: ${svgs.length} (${svgChars} chars, ${pct(svgChars)}), duplicados: ${dupCount}`);
  console.log(`Paths "d" longos (>200): ${paths.length}`);
  console.log(`Base64: ${dataUri} chars`);
  console.log(`Strings gigantes (>300): ${strings.length}`, strings.slice(0, 3).map((s) => s.length));
  console.log(`Espaços/indentação: ${(code.match(/^[ \t]+/gm) || []).join('').length} chars`);
  console.log('Linhas mais longas:', lines);
  console.log('Componentes (function/const Maiúscula):');
  const comps = [...code.matchAll(/(?:function\s+|const\s+)([A-Z]\w+)/g)].map((m) => m[1]);
  console.log([...new Set(comps)].join(', '));
}

function optimize(code) {
  // 1) limpeza: espaços no fim de linha e linhas em branco duplicadas
  let out = code.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
  // 2) className="..." repetidos viram constantes (cN) declaradas após os imports
  const re = /className="([^"{}`$]{25,})"/g;
  const count = {};
  for (const m of out.matchAll(re)) count[m[1]] = (count[m[1]] || 0) + 1;
  const reps = Object.entries(count)
    .filter(([k, v]) => v >= 2 && (v - 1) * (k.length + 3) > 30)
    .sort((a, b) => b[1] * b[0].length - a[1] * a[0].length);
  const names = new Map();
  reps.forEach(([k], i) => names.set(k, `c${i + 1}`));
  out = out.replace(re, (all, k) => (names.has(k) ? `className={${names.get(k)}}` : all));
  const decl = reps.map(([k]) => `const ${names.get(k)} = ${JSON.stringify(k)};`).join('\n');
  const lines = out.split('\n');
  let last = -1;
  lines.forEach((l, i) => { if (/^import\s/.test(l)) last = i; });
  lines.splice(last + 1, 0, decl.length ? '\n// Classes reutilizadas\n' + decl : '');
  console.log(`${reps.length} classes repetidas extraídas`);
  return lines.join('\n');
}

async function run() {
  if (cmd === 'export') return exportSite();
  if (cmd === 'optimize') {
    const s = await getSite();
    fs.mkdirSync(dir, { recursive: true });
    const o = optimize(s.js_content || '');
    fs.writeFileSync(f('js_content.optimized.js'), o);
    const b = (s.js_content || '').length;
    return console.log(`Antes: ${b} | Depois: ${o.length} (-${(((b - o.length) / b) * 100).toFixed(1)}%)\nRevise tools/output/site-${id}/js_content.optimized.js e rode apply.`);
  }
  if (cmd === 'analyze') {
    const s = await getSite();
    return analyze(s.js_content || '');
  }
  if (cmd === 'apply') {
    const file = f('js_content.optimized.js');
    if (!fs.existsSync(file)) throw new Error('Crie ' + file + ' primeiro');
    if (!fs.existsSync(f('js_content.backup.js'))) await exportSite();
    const code = fs.readFileSync(file, 'utf8');
    await pool.query('UPDATE generated_sites SET js_content=$1 WHERE id=$2', [code, id]);
    return console.log(`Aplicado: ${code.length} chars no site ${id}`);
  }
  if (cmd === 'restore') {
    const code = fs.readFileSync(f('js_content.backup.js'), 'utf8');
    await pool.query('UPDATE generated_sites SET js_content=$1 WHERE id=$2', [code, id]);
    return console.log('Backup restaurado.');
  }
  console.log('Comando inválido: export | analyze | apply | restore');
}

run().catch((e) => console.error('Erro:', e.message)).finally(() => pool.end());
