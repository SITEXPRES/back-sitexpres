import { detectarIntencaoPromax } from "./controllers/siteController.js";

console.log("\n========================================================");
console.log("🎯 TESTE DE CLASSIFICAÇÃO DE INTENÇÃO PROMAX VS VITE");
console.log("========================================================\n");

const testes = [
  // --- CASOS DE USUÁRIO LEIGO QUE DEVEM IR PARA PROMAX (SISTEMAS) ---
  {
    nome: "1. Imobiliária (usuário leigo, sem termos técnicos)",
    prompt: "Crie um sistema para imobiliária com cadastro de clientes, corretores, imóveis e métricas de vendas",
    esperaPromax: true
  },
  {
    nome: "2. Loja de roupas (controle de vendas e estoque)",
    prompt: "Quero um sistema para controlar as vendas e o estoque da minha loja de roupas",
    esperaPromax: true
  },
  {
    nome: "3. Clínica médica (painel para agendamentos e pacientes)",
    prompt: "Cria um painel para cadastrar meus pacientes e agendar consultas da clínica",
    esperaPromax: true
  },
  {
    nome: "4. Oficina mecânica (ordens de serviço e clientes)",
    prompt: "Preciso de um sistema para oficina controlar clientes, veículos e ordens de serviço",
    esperaPromax: true
  },
  {
    nome: "5. Financeiro corporativo (gestão financeira e contas)",
    prompt: "Faça um software de gestão financeira para minha empresa com contas a pagar e a receber",
    esperaPromax: true
  },
  {
    nome: "6. Restaurante / Delivery (pedidos e clientes)",
    prompt: "Cria um aplicativo para gerenciar pedidos da minha hamburgueria com clientes e entregas",
    esperaPromax: true
  },
  {
    nome: "7. Escola / Curso (alunos e mensalidades)",
    prompt: "Um painel administrativo para minha escola controlar alunos e mensalidades",
    esperaPromax: true
  },
  {
    nome: "8. Sistema para imobiliária (curto e direto)",
    prompt: "Crie um sistema para imobiliária",
    esperaPromax: true
  },
  {
    nome: "9. Termos técnicos explícitos (dev ou usuário avançado)",
    prompt: "Crie um CRM com banco de dados PostgreSQL, API REST e Docker",
    esperaPromax: true
  },

  // --- CASOS QUE DEVEM PERMANECER NO VITE (SITES INSTITUCIONAIS / LANDING PAGES) ---
  {
    nome: "10. Barbearia (site tradicional com whatsapp)",
    prompt: "Crie um site para minha barbearia com fotos dos cortes, endereço e botão do WhatsApp",
    esperaPromax: false
  },
  {
    nome: "11. Landing Page para lançamento de curso",
    prompt: "Crie uma landing page de alta conversão para divulgar meu novo curso de marketing",
    esperaPromax: false
  },
  {
    nome: "12. Escritório de advocacia (site institucional)",
    prompt: "Faça um site institucional para o escritório de advocacia Mendes & Souza",
    esperaPromax: false
  },
  {
    nome: "13. Pizzaria (cardápio online simples)",
    prompt: "Crie um site para minha pizzaria mostrando o cardápio e horário de funcionamento",
    esperaPromax: false
  },
  {
    nome: "14. Portfólio de fotógrafo",
    prompt: "Quero uma página de portfólio para fotógrafo de casamentos com galeria de fotos",
    esperaPromax: false
  },
  {
    nome: "15. Site de imobiliária vitrine (apenas site)",
    prompt: "Crie apenas um site vitrine para imobiliária com fotos das casas e contato",
    esperaPromax: false
  },
  // --- TESTES DE ISOLAMENTO E PREVENÇÃO DE MISTURA ---
  {
    nome: "16. Usuário no plano site_page pede sistema (deve barrar e ir para site)",
    prompt: "Crie um sistema para imobiliária com cadastro de clientes",
    plano: "site_page",
    esperaPromax: false
  },
  {
    nome: "17. Tela escolheu explicitamente tipo 'site' (deve barrar e ir para site)",
    prompt: "Crie um sistema CRM para imobiliária com postgresql",
    tipo: "site",
    esperaPromax: false
  },
  {
    nome: "18. Projeto existente de site tradicional recebe prompt de favicon/cloudx (NUNCA vira Promax)",
    prompt: "Altere o Favicon para o mesmo do site https://cloudx.com.br/ em todas as paginas",
    metadata: { is_promax: false, subdominio: "sugestodesubdom" },
    esperaPromax: false
  },
  {
    nome: "19. Tela escolheu explicitamente tipo 'sistema' (deve ir para Promax)",
    prompt: "Crie meu sistema de imobiliária",
    tipo: "sistema",
    esperaPromax: true
  }
];

let acertos = 0;

for (const t of testes) {
  const resultado = detectarIntencaoPromax(t.prompt, t.metadata || null, t.tipo || null, t.plano || null);
  const ok = resultado === t.esperaPromax;
  
  console.log(`📌 [${t.esperaPromax ? "PROMAX" : "VITE"}] ${t.nome}`);
  console.log(`💬 Prompt: "${t.prompt}"`);
  console.log(`Resultado: ${resultado ? "🚀 PROMAX (Postgres/Express)" : "🎨 VITE (Site/Landing Page)"} -> ${ok ? "✅ CORRETO" : "❌ FALHOU"}`);
  console.log("--------------------------------------------------------");
  
  if (ok) acertos++;
}

console.log(`\n🎯 TOTAL DE TESTES: ${testes.length} | ACERTOS: ${acertos}`);
if (acertos === testes.length) {
  console.log("🏆 CLASSIFICADOR DE INTENÇÃO APROVADO COM 100% DE ACERTO!");
  process.exit(0);
} else {
  console.log("⚠️ Alguns testes falharam, favor revisar.");
  process.exit(1);
}
