import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

// 🔧 Configuração otimizada para estabilidade
const poolConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  port: Number(process.env.POSTGRES_PORT) || 5432,

  // 🎯 Limites balanceados
  max: 20,                      // mais conexões disponíveis
  min: 2,                       // mantém 2 sempre prontas
  idleTimeoutMillis: 30000,     // 30s para liberar ociosas
  connectionTimeoutMillis: 8000, // 8s timeout (aumentado)
  
  allowExitOnIdle: false,        // NÃO fecha pool automaticamente
  
  // 🔄 Reconexão automática
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  
  ssl: false,
};

const originalPool = new Pool(poolConfig);

// 🔥 Captura erros e reconecta
originalPool.on("error", (err) => {
  console.error("🔥 Pool Error:", err.message);
  // Não trava - apenas loga
});

// 📊 Estatísticas do pool
let totalQueries = 0;
let failedQueries = 0;
let autoReleases = 0;

// 🎯 Wrapper com retry e auto-recovery
const pool = {
  // Query com retry automático (3 tentativas)
  query: async (...args) => {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        totalQueries++;
        const result = await originalPool.query(...args);
        return result;
      } catch (err) {
        lastError = err;
        failedQueries++;
        
        if (attempt < maxRetries) {
          console.warn(`⚠️ Query falhou (tentativa ${attempt}/${maxRetries}):`, err.message);
          // Espera progressiva: 500ms, 1s, 2s
          await new Promise(r => setTimeout(r, 500 * attempt));
        }
      }
    }
    
    console.error(`❌ Query falhou após ${maxRetries} tentativas:`, lastError.message);
    throw lastError;
  },

  // Connect com auto-release inteligente
  connect: async () => {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const client = await originalPool.connect();
        const originalRelease = client.release.bind(client);
        const originalQuery = client.query.bind(client);
        
        let released = false;
        let queryCount = 0;
        const startTime = Date.now();

        // Wrapper do query com contador
        client.query = async (...args) => {
          queryCount++;
          try {
            return await originalQuery(...args);
          } catch (err) {
            // Auto-release em caso de erro
            if (!released) {
              console.warn(`⚠️ Query error - auto-releasing (queries: ${queryCount})`);
              released = true;
              originalRelease();
            }
            throw err;
          }
        };

        // Wrapper do release com proteção
        client.release = (err) => {
          if (!released) {
            released = true;
            const duration = Date.now() - startTime;
            if (duration > 5000) {
              console.warn(`⚠️ Conexão durou ${duration}ms (queries: ${queryCount})`);
            }
            originalRelease(err);
          }
        };

        // 🔥 Auto-release de segurança: 15 segundos
        const timeout = setTimeout(() => {
          if (!released) {
            autoReleases++;
            console.warn(`⚠️ AUTO-RELEASE após 15s (queries: ${queryCount}, total auto: ${autoReleases})`);
            released = true;
            originalRelease();
          }
        }, 15000);

        // Limpa timeout quando liberar manualmente
        const originalReleaseWithCleanup = client.release;
        client.release = (err) => {
          clearTimeout(timeout);
          originalReleaseWithCleanup(err);
        };

        return client;

      } catch (err) {
        lastError = err;
        
        if (attempt < maxRetries) {
          console.warn(`⚠️ Connect falhou (tentativa ${attempt}/${maxRetries}):`, err.message);
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }

    console.error(`❌ Connect falhou após ${maxRetries} tentativas:`, lastError.message);
    throw lastError;
  },

  // Métodos auxiliares
  end: () => originalPool.end(),
  on: (...args) => originalPool.on(...args),
  
  // 📊 Estatísticas
  getStats: () => ({
    totalQueries,
    failedQueries,
    autoReleases,
    poolSize: originalPool.totalCount,
    idleConnections: originalPool.idleCount,
    waitingRequests: originalPool.waitingCount,
  }),
};

// 🧪 Health check com retry na inicialização
(async () => {
  for (let i = 1; i <= 5; i++) {
    try {
      await pool.query("SELECT NOW() as time, version() as pg_version");
      console.log("✅ PostgreSQL conectado com sucesso!");
      console.log(`📊 Pool: max=${poolConfig.max}, min=${poolConfig.min}`);
      return;
    } catch (err) {
      console.error(`❌ Tentativa ${i}/5 falhou:`, err.message);
      if (i < 5) {
        await new Promise(r => setTimeout(r, 2000));
      } else {
        console.error("💀 FALHA CRÍTICA: PostgreSQL inacessível");
        // NÃO faz process.exit() - deixa a app tentar se recuperar
      }
    }
  }
})();

// 🔍 Monitor de saúde a cada 30 segundos
setInterval(() => {
  const stats = pool.getStats();
  
  // Alerta se houver problemas
  if (stats.waitingRequests > 5) {
    console.warn(`⚠️ ALERTA: ${stats.waitingRequests} requisições esperando conexão!`);
  }
  
  if (stats.autoReleases > 10) {
    console.warn(`⚠️ ALERTA: ${stats.autoReleases} auto-releases (possível vazamento de conexões)`);
  }

  // Log informativo a cada 5 minutos
  if (Math.floor(Date.now() / 1000) % 300 === 0) {
    console.log(`📊 Stats: queries=${stats.totalQueries}, falhas=${stats.failedQueries}, pool=${stats.poolSize}/${poolConfig.max}, idle=${stats.idleConnections}, waiting=${stats.waitingRequests}`);
  }
}, 30000);

// 🛡️ Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM recebido - fechando pool...");
  try {
    await originalPool.end();
    console.log("✅ Pool fechado com sucesso");
    process.exit(0);
  } catch (err) {
    console.error("❌ Erro ao fechar pool:", err);
    process.exit(1);
  }
});

process.on("SIGINT", async () => {
  console.log("🛑 SIGINT recebido - fechando pool...");
  try {
    await originalPool.end();
    console.log("✅ Pool fechado com sucesso");
    process.exit(0);
  } catch (err) {
    console.error("❌ Erro ao fechar pool:", err);
    process.exit(1);
  }
});

export default pool;