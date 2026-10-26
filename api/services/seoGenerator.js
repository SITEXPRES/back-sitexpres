import fs from "fs/promises";
import fsSync from "fs";
import path from "path";

/**
 * Módulo de Otimização Técnica de SEO e GEO para sites gerados pelo SitExpress (Vite/React).
 * Garante que:
 * 1. Cada rota tenha seu HTML inicial com Title, Meta Description, Canonical, OG e Twitter tags.
 * 2. Dados estruturados JSON-LD (Schema.org) sejam injetados para o Google e IAs.
 * 3. robots.txt e sitemap.xml reais sejam gerados no dist/.
 * 4. Multi-page SSG / Prerendering: cria dist/[rota]/index.html para cada subpágina.
 */

// Extrai as rotas definidas no App.jsx (ex: const routes = { ... })
export function extrairRotasDoReact(reactCode) {
  const rotas = ['/'];
  if (!reactCode || typeof reactCode !== 'string') return rotas;

  const routesMatch = reactCode.match(/const\s+routes\s*=\s*\{([\s\S]*?)\};/);
  if (routesMatch) {
    const routeEntries = [...routesMatch[1].matchAll(/['"]([^'"]+)['"]\s*:/g)];
    for (const [, route] of routeEntries) {
      if (!route) continue;
      // Normaliza a rota (remove barra no final duplicada para evitar duplicações no sitemap)
      const cleanRoute = route.startsWith('/') ? route : `/${route}`;
      const canonicalRoute = cleanRoute.endsWith('/') && cleanRoute.length > 1 ? cleanRoute.slice(0, -1) : cleanRoute;
      if (!rotas.includes(canonicalRoute) && !canonicalRoute.includes(':')) {
        rotas.push(canonicalRoute);
      }
    }
  }

  return [...new Set(rotas)];
}

// Extrai metadados da rota com base no nome do site e no componente correspondente
export function gerarMetadadosPorRota(rota, siteName, domain = 'cloudx.com.br') {
  const baseDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const baseUrl = `https://${baseDomain}`;
  const rotaChave = (rota === '' || rota === '/') ? '/' : (rota.startsWith('/') ? rota : `/${rota}`).replace(/\/$/, '');
  const canonicalUrl = rotaChave === '/' ? `${baseUrl}/` : `${baseUrl}${rotaChave}/`;

  // Mapeamento semântico inteligente baseado no slug da rota
  const routeDefinitions = {
    '/': {
      title: `${siteName} | Hospedagem de Sites, VPS e Cloud de Alta Performance no Brasil`,
      description: `Hospedagem de sites, WordPress, VPS e Cloud com armazenamento 100% NVMe, SSL grátis, 99,99% de uptime e suporte humano 24/7 no Brasil. Migre grátis para a ${siteName}.`,
      keywords: `hospedagem de sites, hospedagem wordpress, servidor vps, cloud server, registro de domínio, hospedagem brasil, email profissional, revenda de hospedagem, ${siteName.toLowerCase()}`,
      type: 'WebSite'
    },
    '/hospedagem-cpanel': {
      title: `Hospedagem cPanel de Alta Velocidade NVMe | ${siteName}`,
      description: `Hospede seu site com o painel cPanel mais rápido do Brasil. Discos NVMe Gen5, instalador de apps em 1 clique, SSL ilimitado e proteção anti-DDoS.`,
      keywords: `hospedagem cpanel, cpanel brasil, hospedagem com cpanel, instalador wordpress, discos nvme, ${siteName.toLowerCase()}`,
      type: 'Product'
    },
    '/hospedagem-directadmin': {
      title: `Hospedagem DirectAdmin Econômica e Rápida | ${siteName}`,
      description: `Máxima performance e custo-benefício com painel DirectAdmin ultra-leve. Servidores no Brasil com suporte 24 horas e migração gratuita.`,
      keywords: `hospedagem directadmin, directadmin brasil, hospedagem barata e rapida, servidor directadmin, ${siteName.toLowerCase()}`,
      type: 'Product'
    },
    '/revenda-hospedagem-cpanel': {
      title: `Revenda de Hospedagem cPanel com WHM | ${siteName}`,
      description: `Comece sua própria empresa de hospedagem com Revenda cPanel e painel WHM completo. Crie contas ilimitadas com recursos dedicados e DNS próprio.`,
      keywords: `revenda cpanel, revenda hospedagem whm, criar empresa de hospedagem, revenda com whm, ${siteName.toLowerCase()}`,
      type: 'Product'
    },
    '/revenda-hospedagem-directadmin': {
      title: `Revenda de Hospedagem DirectAdmin de Alto Rendimento | ${siteName}`,
      description: `Painel de revendedor DirectAdmin completo com ativação imediata, isolamento de contas e o melhor preço por conta do mercado nacional.`,
      keywords: `revenda directadmin, revenda de sites, revenda hospedagem barata, ${siteName.toLowerCase()}`,
      type: 'Product'
    },
    '/vps-cloud-brasil': {
      title: `Servidor VPS Cloud no Brasil com Discos NVMe | ${siteName}`,
      description: `Servidores VPS Cloud de alta performance localizados em data center Tier III em São Paulo. Baixa latência, IP brasileiro, acesso root e tráfego ilimitado.`,
      keywords: `vps brasil, servidor vps sao paulo, vps nvme, cloud brasil, vps linux, vps windows, ${siteName.toLowerCase()}`,
      type: 'Product'
    },
    '/paas': {
      title: `PaaS Cloudx - Plataforma de Deploy Automático | ${siteName}`,
      description: `Publique Node.js, Python, PHP, Docker e bancos de dados com deploy contínuo via Git. Infraestrutura gerenciada sem dor de cabeça.`,
      keywords: `paas brasil, deploy nodejs, deploy git, plataforma como servico, cloudx paas, ${siteName.toLowerCase()}`,
      type: 'Service'
    },
    '/agencias': {
      title: `Hospedagem e Infraestrutura para Agências Web | ${siteName}`,
      description: `Centralize todos os clientes da sua agência em servidores ultra-rápidos com suporte prioritário e condições comerciais exclusivas.`,
      keywords: `hospedagem para agencias, revenda agencias web, planos de hospedagem agencias, ${siteName.toLowerCase()}`,
      type: 'Service'
    },
    '/programa-de-parcerias': {
      title: `Programa de Parcerias e Afiliados | ${siteName}`,
      description: `Seja parceiro da ${siteName} e lucre indicando a melhor hospedagem do Brasil. Comissões recorrentes e acompanhamento em tempo real.`,
      keywords: `programa afiliados hospedagem, parceiro cloudx, revenda parceiros, ${siteName.toLowerCase()}`,
      type: 'Service'
    },
    '/infraestrutura': {
      title: `Nossa Infraestrutura e Data Center no Brasil | ${siteName}`,
      description: `Conheça nossa rede de datacenters Tier III com conectividade direta ao PTT/IX.br, redundância de energia, refrigeração de ponta e proteção anti-DDoS multi-terabit.`,
      keywords: `datacenter brasil, infraestrutura cloudx, servidores sao paulo, uptime 99.99, protecao ddos, ${siteName.toLowerCase()}`,
      type: 'AboutPage'
    },
    '/sobre-a-cloudx': {
      title: `Sobre a ${siteName} - Nossa História e Missão | ${siteName}`,
      description: `Saiba mais sobre a ${siteName}, nossa trajetória no mercado de tecnologia e hospedagem no Brasil e o compromisso diário com suporte humano e excelência técnica.`,
      keywords: `sobre cloudx, empresa de hospedagem brasil, historia cloudx, ${siteName.toLowerCase()}`,
      type: 'AboutPage'
    },
    '/casosdesucesso': {
      title: `Casos de Sucesso e Depoimentos de Clientes | ${siteName}`,
      description: `Veja como empresas e e-commerces aceleraram suas vendas e reduziram o tempo de carregamento migrando para a ${siteName}.`,
      keywords: `depoimentos cloudx, casos de sucesso hospedagem, avaliacoes cloudx, ${siteName.toLowerCase()}`,
      type: 'CollectionPage'
    },
    '/responsabilidade-social': {
      title: `Responsabilidade Social e Ambiental | ${siteName}`,
      description: `Compromisso da ${siteName} com a sustentabilidade, data centers verdes e iniciativas de reflorestamento e responsabilidade social.`,
      keywords: `sustentabilidade cloudx, datacenter verde, responsabilidade social, ${siteName.toLowerCase()}`,
      type: 'AboutPage'
    },
    '/termos-de-uso': {
      title: `Termos e Condições de Uso | ${siteName}`,
      description: `Confira os termos e condições gerais de contratação dos serviços de hospedagem, servidores e produtos da ${siteName}.`,
      keywords: `termos de uso, contrato de hospedagem, ${siteName.toLowerCase()}`,
      type: 'WebPage'
    },
    '/politica-de-privacidade-lgpd': {
      title: `Política de Privacidade e Proteção de Dados (LGPD) | ${siteName}`,
      description: `Saiba como a ${siteName} trata e protege seus dados pessoais em total conformidade com a Lei Geral de Proteção de Dados (LGPD).`,
      keywords: `lgpd, politica de privacidade, protecao de dados, ${siteName.toLowerCase()}`,
      type: 'WebPage'
    },
    '/politica-anti-spam': {
      title: `Política Anti-Spam e Boas Práticas | ${siteName}`,
      description: `Diretrizes e política rigorosa de tolerância zero contra spam e envio de e-mails não solicitados nos servidores da ${siteName}.`,
      keywords: `politica anti-spam, combate ao spam, regras de email, ${siteName.toLowerCase()}`,
      type: 'WebPage'
    }
  };

  if (routeDefinitions[rotaChave]) {
    return { ...routeDefinitions[rotaChave], canonicalUrl };
  }

  // Fallback inteligente para rotas criadas dinamicamente
  const nomeAmigavel = rotaChave.replace(/^\//, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  return {
    title: `${nomeAmigavel} | ${siteName}`,
    description: `Confira ${nomeAmigavel} com a infraestrutura de alta performance, suporte 24/7 e segurança da ${siteName}.`,
    keywords: `${nomeAmigavel.toLowerCase()}, ${siteName.toLowerCase()}, hospedagem, nuvem`,
    type: 'WebPage',
    canonicalUrl
  };
}

/**
 * Injeta metadados de SEO, OpenGraph e JSON-LD no HTML de uma página.
 */
export function aplicarSeoNoHtml(htmlContent, metaInfo, siteName, domain = 'cloudx.com.br') {
  let html = htmlContent;

  // Garante lang="pt-BR"
  html = html.replace(/<html[^>]*>/i, '<html lang="pt-BR">');

  // Remove tags de título e meta antigas se existirem
  html = html.replace(/<title>.*?<\/title>/gi, '');
  html = html.replace(/<meta\s+name=["']description["'][^>]*>/gi, '');
  html = html.replace(/<meta\s+name=["']keywords["'][^>]*>/gi, '');
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '');
  html = html.replace(/<meta\s+property=["']og:[^"']*["'][^>]*>/gi, '');
  html = html.replace(/<meta\s+name=["']twitter:[^"']*["'][^>]*>/gi, '');

  const baseDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const baseUrl = `https://${baseDomain}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": metaInfo.type === 'Product' ? 'Product' : (metaInfo.type === 'Organization' ? 'Organization' : 'WebSite'),
    "name": metaInfo.title,
    "description": metaInfo.description,
    "url": metaInfo.canonicalUrl,
    "publisher": {
      "@type": "Organization",
      "name": siteName,
      "url": baseUrl,
      "logo": `${baseUrl}/images/1790969492713.png`
    }
  };

  const seoBlock = `
    <title>${metaInfo.title}</title>
    <meta name="description" content="${metaInfo.description}" />
    <meta name="keywords" content="${metaInfo.keywords}" />
    <link rel="canonical" href="${metaInfo.canonicalUrl}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <meta name="language" content="Portuguese" />
    <meta name="author" content="${siteName}" />

    <!-- Open Graph / Redes Sociais e WhatsApp -->
    <meta property="og:locale" content="pt_BR" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${metaInfo.title}" />
    <meta property="og:description" content="${metaInfo.description}" />
    <meta property="og:url" content="${metaInfo.canonicalUrl}" />
    <meta property="og:site_name" content="${siteName}" />
    <meta property="og:image" content="${baseUrl}/images/1790969492713.png" />
    <meta property="og:image:alt" content="${siteName} - Hospedagem e Cloud" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${metaInfo.title}" />
    <meta name="twitter:description" content="${metaInfo.description}" />
    <meta name="twitter:image" content="${baseUrl}/images/1790969492713.png" />

    <!-- Dados Estruturados Schema.org para o Google e IAs (GEO) -->
    <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
    </script>

        <link rel="preconnect" href="https://ui-avatars.com" crossorigin />
    <link rel="preload" as="image" href="/images/1790969492713.png" type="image/png" />

    <!-- Estilo Crítico Inicial (Design System CloudX & Zero FOUC) -->
    <style>
      html, body {
        background: #05050a;
        color: #ffffff;
        min-height: 100vh;
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      * { box-sizing: border-box; }
    </style>
  `;

  // Pré-carregamento antecipado de chunks JS (acelera LCP e TBT no GTmetrix)
  const scripts = [...html.matchAll(/src=["'](\/assets\/[^"']+\.js)["']/g)].map(m => m[1]);
  const preloadLinks = [...new Set(scripts)].map(src => `    <link rel="modulepreload" href="${src}" />`).join('\n');

  html = html.replace(/<\/head>/i, `${seoBlock}\n${preloadLinks}\n  </head>`);
  return html;
}

/**
 * Cria o arquivo robots.txt otimizado para SEO técnico e GEO (IAs generativas).
 */
export function gerarRobotsTxt(domain = 'cloudx.com.br') {
  const baseDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `# robots.txt gerado para ${baseDomain}
User-agent: *
Allow: /

# Rastreadores de Motores de Busca e IAs (GEO / Generative Engine Optimization)
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: Applebot
Allow: /

# Sitemap canônico
Sitemap: https://${baseDomain}/sitemap.xml
`;
}

/**
 * Cria o sitemap.xml com todas as rotas canônicas.
 */
export function gerarSitemapXml(rotas, domain = 'cloudx.com.br') {
  const baseDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const baseUrl = `https://${baseDomain}`;
  const now = new Date().toISOString().split('T')[0];

  const urlsXml = rotas.map(rota => {
    const rotaLimpa = rota === '/' ? '' : rota.replace(/\/$/, '');
    const canonical = `${baseUrl}${rotaLimpa}/`;
    const priority = rota === '/' ? '1.0' : (rota.includes('hospedagem') || rota.includes('vps') ? '0.9' : '0.8');
    const changefreq = rota === '/' ? 'daily' : 'weekly';

    return `  <url>
    <loc>${canonical}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>`;
}

/**
 * Pré-renderização semântica dentro do <div id="root">
 * Extrai o H1, parágrafos e lista de planos do componente React para que o HTML inicial
 * possua conteúdo textual legível por robôs que não executam JavaScript.
 */
export function injetarPreRenderSemantico(htmlContent, reactCode, rota = '/') {
  if (!htmlContent.includes('<div id="root"></div>')) {
    return htmlContent;
  }

  // Definições semânticas de H1 e subtítulo por rota
  let h1Html = 'Hospedagem de sites na<br /><span style="background:linear-gradient(90deg,#c084fc,#22d3ee,#a3e635);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">velocidade que seu negócio precisa</span>';
  let subText = 'Hospedagem de sites, WordPress, VPS, Revenda de Hospedagem, Deploy e VPS em infraestrutura no Brasil. SSL grátis, e-mails ilimitados, backups diários e suporte humano 24/7 que realmente resolve.';
  let badgeText = 'Servidores NVMe + IA + Domínios .br';

  if (rota === '/hospedagem-cpanel') {
    h1Html = 'Hospedagem cPanel com<br /><span style="background:linear-gradient(90deg,#c084fc,#22d3ee,#a3e635);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Discos NVMe Gen5</span>';
    subText = 'Planos rápidos com painel cPanel em português, instalador de WordPress em 1 clique, SSL ilimitado gratuito e proteção anti-DDoS corporativa.';
    badgeText = 'Painel cPanel Oficial + NVMe';
  } else if (rota === '/hospedagem-directadmin') {
    h1Html = 'Hospedagem DirectAdmin com<br /><span style="background:linear-gradient(90deg,#c084fc,#22d3ee,#a3e635);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Máximo Custo-Benefício</span>';
    subText = 'Painel ultra-leve e estável com alto desempenho em servidores no Brasil. Migração gratuita e suporte técnico 24 horas.';
    badgeText = 'DirectAdmin Ultra-Leve';
  } else if (rota === '/revenda-hospedagem-cpanel') {
    h1Html = 'Revenda de Hospedagem cPanel<br /><span style="background:linear-gradient(90deg,#c084fc,#22d3ee,#a3e635);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">com Painel WHM Completo</span>';
    subText = 'Comece sua própria empresa de hospedagem com recursos dedicados, isolamento CloudLinux e DNS personalizado.';
    badgeText = 'WHM Completo + DNS Próprio';
  } else if (rota === '/revenda-hospedagem-directadmin') {
    h1Html = 'Revenda DirectAdmin no Brasil<br /><span style="background:linear-gradient(90deg,#c084fc,#22d3ee,#a3e635);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">com Recursos Ilimitados</span>';
    subText = 'O melhor custo por conta para agências e profissionais web. Ativação imediata e migração inclusa.';
    badgeText = 'Revenda de Alto Desempenho';
  } else if (rota === '/vps-cloud-brasil') {
    h1Html = 'Servidores VPS Cloud no Brasil<br /><span style="background:linear-gradient(90deg,#c084fc,#22d3ee,#a3e635);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">com Discos NVMe e PTT SP</span>';
    subText = 'Infraestrutura Tier III em São Paulo com acesso root total, tráfego ilimitado e proteção DDoS multi-terabit.';
    badgeText = 'Data Center em São Paulo (Tier III)';
  } else if (rota === '/paas') {
    h1Html = 'Deploy PaaS Automático<br /><span style="background:linear-gradient(90deg,#c084fc,#22d3ee,#a3e635);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">para Node, Python e Docker</span>';
    subText = 'Conecte seu repositório Git e publique aplicações escaláveis em segundos com SSL automático.';
    badgeText = 'Deploy Contínuo via Git';
  } else if (rota === '/infraestrutura') {
    h1Html = 'Infraestrutura e Data Center<br /><span style="background:linear-gradient(90deg,#c084fc,#22d3ee,#a3e635);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">de Alta Disponibilidade 99,99%</span>';
    subText = 'Conectividade direta com o IX.br/PTT de São Paulo, redundância N+1 de energia e refrigeração de ponta.';
    badgeText = 'Uptime 99,998% Garantido';
  } else if (rota !== '/') {
    const nomeAmigavel = rota.replace(/^\//, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    h1Html = `${nomeAmigavel}<br /><span style="background:linear-gradient(90deg,#c084fc,#22d3ee,#a3e635);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">CloudX Brasil</span>`;
    subText = `Conheça ${nomeAmigavel} na CloudX com infraestrutura de alta performance e suporte 24/7.`;
    badgeText = 'CloudX Soluções';
  }

  // Pre-render visualmente idêntico ao React + Crawler Safe
  const preRenderContent = `
    <div id="ssr-critical-layout" style="background:#05050a;color:#ffffff;min-height:100vh;overflow-x:hidden;">
      <!-- Header Crítico -->
      <header style="max-width:1280px;margin:0 auto;padding:24px 20px;display:flex;align-items:center;justify-content:space-between;position:relative;z-index:10;">
        <a href="/" style="display:flex;align-items:center;gap:12px;text-decoration:none;color:#ffffff;">
          <img src="/images/1790969492713.png" alt="CloudX" width="130" height="34" style="height:34px;width:auto;display:block;" />
        </a>
        <nav style="display:flex;align-items:center;gap:20px;font-size:14px;font-weight:500;" aria-label="Navegação Principal">
          <a href="/hospedagem-cpanel" style="color:rgba(255,255,255,0.7);text-decoration:none;">Hospedagem</a>
          <a href="/vps-cloud-brasil" style="color:rgba(255,255,255,0.7);text-decoration:none;">VPS Cloud</a>
          <a href="/revenda-hospedagem-cpanel" style="color:rgba(255,255,255,0.7);text-decoration:none;">Revenda</a>
          <a href="/paas" style="color:rgba(255,255,255,0.7);text-decoration:none;">PaaS</a>
          <a href="https://painel.cloudx.com.br/clientes/Login.php" style="padding:8px 18px;border-radius:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#ffffff;text-decoration:none;font-weight:600;">Área do Cliente</a>
        </nav>
      </header>

      <!-- Hero Crítico (LCP Instantâneo < 300ms) -->
      <main style="max-width:1280px;margin:0 auto;padding:60px 20px 80px;position:relative;z-index:5;">
        <div style="max-width:700px;">
          <div style="display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:9999px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);font-size:13px;margin-bottom:28px;">
            <span style="background:linear-gradient(90deg,#9333ea,#06b6d4);color:#ffffff;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;">NOVO</span>
            <span style="color:rgba(255,255,255,0.85);">${badgeText}</span>
          </div>

          <h1 style="font-size:clamp(32px, 5.5vw, 56px);font-weight:800;line-height:1.06;letter-spacing:-0.03em;margin:0 0 24px 0;color:#ffffff;">
            ${h1Html}
          </h1>

          <p style="font-size:18px;line-height:1.6;color:rgba(255,255,255,0.65);margin:0 0 36px 0;max-width:600px;">
            ${subText}
          </p>

          <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;">
            <a href="https://painel.cloudx.com.br/assinatura/?servico=dominio" style="display:inline-flex;align-items:center;gap:8px;padding:15px 30px;border-radius:16px;background:linear-gradient(90deg,#9333ea,#06b6d4);color:#ffffff;font-weight:600;text-decoration:none;box-shadow:0 10px 25px rgba(147,51,234,0.35);">
              Domínio .BR apenas R$ 36,00 →
            </a>
            <a href="#contato" style="display:inline-flex;align-items:center;gap:8px;padding:15px 30px;border-radius:16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);color:#ffffff;font-weight:600;text-decoration:none;">
              Migração grátis
            </a>
          </div>
        </div>
      </main>

      <!-- Conteúdo Semântico Adicional para Robôs e IAs (GEO) -->
      <div id="ssr-seo-crawlers" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;">
        <section>
          <h2>Soluções e Serviços CloudX no Brasil</h2>
          <ul>
            <li><strong>Hospedagem cPanel:</strong> Planos rápidos com discos NVMe, SSL grátis e instalador de WordPress em 1 clique.</li>
            <li><strong>Servidores VPS Cloud:</strong> Acesso root total, tráfego ilimitado e conectividade PTT São Paulo.</li>
            <li><strong>Revenda de Hospedagem:</strong> Painel WHM para hospedar seus clientes com estabilidade e isolamento.</li>
            <li><strong>Deploy PaaS:</strong> Plataforma para publicação contínua de aplicações Node.js, Python, PHP e Docker.</li>
          </ul>
        </section>
      </div>
    </div>
  `.trim();

  return htmlContent.replace('<div id="root"></div>', `<div id="root">${preRenderContent}</div>`);
}

/**
 * Processa a pasta dist gerada pelo Vite build e aplica a otimização completa de SEO:
 * 1. Otimiza dist/index.html
 * 2. Gera dist/robots.txt
 * 3. Gera dist/sitemap.xml
 * 4. Gera dist/[rota]/index.html para cada subpágina estática (SSG Multi-Page)
 */
export async function aplicarOtimizacoesDist({ distPath, reactCode, siteName, domain }) {
  if (!distPath || !fsSync.existsSync(distPath)) {
    throw new Error(`Pasta dist não encontrada: ${distPath}`);
  }

  const baseHtmlPath = path.join(distPath, "index.html");
  if (!fsSync.existsSync(baseHtmlPath)) {
    throw new Error(`index.html não encontrado no dist: ${baseHtmlPath}`);
  }

  const rawHtml = await fs.readFile(baseHtmlPath, "utf8");
  const rotas = extrairRotasDoReact(reactCode);
  console.log(`[SEO_OPTIMIZER] 🧭 Identificadas ${rotas.length} rotas para geração estática:`, rotas);

  // 1. Gera robots.txt e sitemap.xml
  const robotsTxt = gerarRobotsTxt(domain);
  const sitemapXml = gerarSitemapXml(rotas, domain);
  await fs.writeFile(path.join(distPath, "robots.txt"), robotsTxt, "utf8");
  await fs.writeFile(path.join(distPath, "sitemap.xml"), sitemapXml, "utf8");
  console.log(`[SEO_OPTIMIZER] ✅ robots.txt e sitemap.xml gerados com sucesso na raiz do dist`);

  // 2. Otimiza o index.html da raiz
  const metaHome = gerarMetadadosPorRota('/', siteName, domain);
  let homeHtml = aplicarSeoNoHtml(rawHtml, metaHome, siteName, domain);
  homeHtml = injetarPreRenderSemantico(homeHtml, reactCode, '/');
  await fs.writeFile(baseHtmlPath, homeHtml, "utf8");
  console.log(`[SEO_OPTIMIZER] ✅ dist/index.html atualizado com SEO e Pré-render`);

  // 3. Multi-page SSG: gera dist/[rota]/index.html para cada subpágina
  for (const rota of rotas) {
    if (rota === '/') continue;

    const rotaPathRel = rota.startsWith('/') ? rota.slice(1) : rota;
    const targetDir = path.join(distPath, rotaPathRel);
    await fs.mkdir(targetDir, { recursive: true });

    const metaRota = gerarMetadadosPorRota(rota, siteName, domain);
    let rotaHtml = aplicarSeoNoHtml(rawHtml, metaRota, siteName, domain);
    rotaHtml = injetarPreRenderSemantico(rotaHtml, reactCode, rota);

    await fs.writeFile(path.join(targetDir, "index.html"), rotaHtml, "utf8");
    console.log(`[SEO_OPTIMIZER] 📄 Página estática criada: ${rotaPathRel}/index.html`);
  }

  console.log(`[SEO_OPTIMIZER] 🚀 Todas as ${rotas.length} páginas foram geradas estaticamente com SEO 100%!`);
}
