// api/services/cron-stats.js
import 'dotenv/config';
import pool from '../config/db.js';
import { getStatsFromFTP } from './webalizerService.js';

async function run() {
  console.log(`--- [${new Date().toLocaleString()}] Iniciando coleta de estatísticas de sites ---`);

  try {
    // Busca todos os sites ativos com username e id_projeto preenchido
    const { rows } = await pool.query(`
      SELECT id_projeto, dominio, username, senha
      FROM hospedagens
      WHERE status = 'ativo'
        AND id_projeto IS NOT NULL
    `);

    console.log(`📋 ${rows.length} hospedagem(ns) encontrada(s) para processar.`);

    for (const site of rows) {
      try {
        // Obtém estatísticas via FTP usando username + dominio
        const stats = await getStatsFromFTP(site.username, site.dominio, site.senha);

        const entries = Object.entries(stats);
        if (entries.length === 0) {
          console.warn(`⚠️  Nenhuma estatística encontrada para: ${site.dominio}`);
          continue;
        }

        for (const [date, data] of entries) {
          // Converte formato YYYYMM → YYYY-MM-01
          const formattedDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-01`;

          await pool.query(`
            INSERT INTO site_analytics
              (site_id, date, views_count, hits, files, id_projeto, updated_at)
            SELECT
              gs.id,
              $2,
              $3,
              $4,
              $5,
              $6,
              NOW()
            FROM generated_sites gs
            WHERE gs.id_projeto = $1
            LIMIT 1
            ON CONFLICT (site_id, date)
            DO UPDATE SET
              views_count = EXCLUDED.views_count,
              hits        = EXCLUDED.hits,
              files       = EXCLUDED.files,
              id_projeto  = EXCLUDED.id_projeto,
              updated_at  = NOW()
          `, [
            site.id_projeto,   // $1 — para localizar o site_id em generated_sites
            formattedDate,     // $2
            data.visits,       // $3 — views_count
            data.hits,         // $4
            data.files,        // $5
            site.id_projeto,   // $6 — id_projeto direto em site_analytics
          ]);
        }

        console.log(`✅ Atualizado: ${site.dominio} (${entries.length} período(s))`);

      } catch (siteErr) {
        console.error(`❌ Erro ao processar ${site.dominio}:`, siteErr.message);
      }
    }

  } catch (err) {
    console.error('❌ Erro crítico no cron de stats:', err);
  } finally {
    console.log('--- Fim do processamento ---');
    await pool.end();
  }
}

run();