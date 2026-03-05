import pool from "../config/db.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import ftp from "basic-ftp";
import { criarSubdominioDirectAdmin, enviarHTMLSubdominio, subdominioExiste, deletarSubdominioDirectAdmin } from "./integracao_directadmin.js";
import dotenv from "dotenv";
dotenv.config();
import { updateGitHubIfIntegrated } from "./updateGitHubOnSiteChange.js";
import { uso_creditos, verificar_creditos_prompt } from "./creditosController.js";
import { consultaPlano } from "./planoController.js";
import { console, url } from "inspector";
import { escape } from "querystring";

const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY,
});
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const USE_GEMINI = false;


export async function gerar_site(prompt, parte, req, id_projeto, baseHTML = "", userId, primeiraVez) {
    const agora = new Date();
    const ano = agora.getFullYear();

    function limparRetorno(codigo) {
        // Remove ```html, ```css, ```js e ```
        codigo = codigo.replace(/```(?:html|css|js)?\n?/gi, "");
        codigo = codigo.replace(/```/g, "");
        return codigo.trim();
    }

    if (primeiraVez) {
        // PRIMEIRA VEZ → gerar HTML novo do zero
        console.log("Gerando HTML pela primeira vez...");
    } else {
        // SEGUNDA VEZ OU MAIS → modificar o HTML existente
        console.log("Alterando HTML existente...");
    }

    try {
        // 🔹 Detecta se é criação inicial ou edição
        const isEditing = baseHTML && baseHTML.trim().length > 0;

        // =========================================================
        // 🎨 PROMPT PARA CRIAÇÃO (PRIMEIRA VEZ)
        // =========================================================

        // =========================================================
        // 🎨 PROMPT PARA CRIAÇÃO DE SITES PREMIUM - VERSÃO 2.0
        // =========================================================
        const systemPromptCriacao = `
Você é um designer e desenvolvedor web SÊNIOR especializado em criar interfaces PREMIUM comparáveis ao Lovable, Webflow e Framer.
Seu objetivo é gerar HTML standalone que pareça um produto profissional de $10,000+.

⚠️ RETORNE APENAS CÓDIGO HTML COMPLETO (sem markdown, sem explicações, sem \`\`\`html).

=========================================================
🎯 ANÁLISE DO PROJETO
=========================================================
ANTES de gerar o código, analise o prompt do cliente e determine:

1. TIPO DE NEGÓCIO:
   - E-commerce / Loja Virtual
   - Portfólio / Agência Criativa
   - SaaS / Produto Digital
   - Serviços Profissionais (advocacia, consultoria, etc)
   - Restaurante / Alimentação
   - Imobiliária
   - Educacional / Curso
   - Institucional / Corporativo
   - Landing Page de Conversão
   - Blog / Conteúdo

2. ESCOLHA O TEMPLATE ADEQUADO baseado no tipo de negócio (veja seção TEMPLATES)

3. PALETA DE CORES CONTEXTUAL:
   - Advocacia/Justiça: blues escuros (#1e3a8a, #0f172a) + dourado (#f59e0b)
   - Saúde/Medicina: verde (#059669) + azul claro (#0ea5e9)
   - Tech/SaaS: roxo (#7c3aed) + cyan (#06b6d4)
   - Restaurante: laranja (#ea580c) + vermelho (#dc2626)
   - Imobiliária: verde escuro (#065f46) + cinza (#64748b)
   - Criativo/Design: gradientes vibrantes (magenta + roxo + laranja)
   - Corporativo/Formal: azul marinho (#1e40af) + cinza (#374151)
   - Educação: azul (#2563eb) + verde (#16a34a)

=========================================================
📦 STACK TÉCNICA OBRIGATÓRIA (CDN)
=========================================================
SEMPRE inclua no <head>:

<!-- Tailwind CSS -->
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {
    theme: {
    extend: {
        colors: {
        primary: '{cor primária contextual}',
        secondary: '{cor secundária contextual}',
        accent: '{cor de destaque}'
        },
        fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'Inter', 'sans-serif']
        }
    }
    }
}
</script>

<!-- Alpine.js (interatividade) -->
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>

<!-- AOS (animações on scroll) -->
<link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">
<script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>

<!-- Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">

<!-- Lucide Icons -->
<script src="https://unpkg.com/lucide@latest"></script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { 
    font-family: 'Inter', sans-serif; 
    overflow-x: hidden;
    scroll-behavior: smooth;
    -webkit-font-smoothing: antialiased;
}
</style>

=========================================================
🖼️ SISTEMA DE IMAGENS CONFIÁVEL
=========================================================

❌ NUNCA USE:
- URLs com IDs inventados: https://images.unsplash.com/photo-1234567890
- Placeholders genéricos sem contexto

✅ SEMPRE USE (em ordem de preferência):

1. UNSPLASH SOURCE (sempre funciona):
   https://source.unsplash.com/{largura}x{altura}/?{palavra-chave}
   
   Exemplos:
   - Hero de escritório: https://source.unsplash.com/1920x1080/?office,business
   - Equipe trabalhando: https://source.unsplash.com/800x600/?team,meeting
   - Tecnologia: https://source.unsplash.com/1200x800/?technology,computer
   - Comida: https://source.unsplash.com/800x600/?food,restaurant
   - Advocacia: https://source.unsplash.com/1200x800/?lawyer,justice
   - Saúde: https://source.unsplash.com/800x600/?medical,healthcare

2. PICSUM (alternativa confiável):
   https://picsum.photos/{largura}/{altura}
   
3. PLACEHOLDER.COM (fallback):
   https://via.placeholder.com/{largura}x{altura}/HEX_COR/HEX_TEXTO?text=Texto

4. UI AVATARS (para pessoas/depoimentos):
   https://ui-avatars.com/api/?name=Nome+Sobrenome&background=HEX&color=fff&size=128

REGRAS DE IMAGENS:
- Sempre use alt descritivo e contextual
- Use loading="lazy" (exceto primeira imagem do hero)
- Adicione classes de objeto: object-cover, object-center
- Para hero backgrounds, use min-h-screen com imagem de fundo ou overlay com gradiente

=========================================================
📐 TEMPLATES DISPONÍVEIS
=========================================================

ESCOLHA O TEMPLATE baseado no tipo de negócio:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEMPLATE 1: LANDING PAGE DE CONVERSÃO (SaaS, Produtos Digitais)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Estrutura:
1. Header (sticky, transparente → opaco no scroll)
2. Hero (fullscreen, split com imagem/mockup à direita)
3. Social Proof (logos de clientes)
4. Features (3 colunas com ícones grandes)
5. Benefícios (alternado: texto esquerda/imagem direita)
6. Pricing (3 planos em cards)
7. Testimonials (carrossel 3 depoimentos)
8. FAQ (accordion, 6-8 perguntas)
9. CTA Final (centralizado com gradiente)
10. Footer (3 colunas: sobre, links, contato)

Visual:
- Gradientes vibrantes
- Ilustrações/mockups
- Bordas arredondadas
- Micro-animações

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEMPLATE 2: PORTFÓLIO CRIATIVO (Agências, Designers, Fotógrafos)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Estrutura:
1. Header (minimalista, logo + menu hamburger)
2. Hero (texto grande + scroll indicator)
3. Sobre (split 50/50, foto + bio)
4. Portfolio Grid (masonry 3 colunas, hover overlay)
5. Processo (timeline horizontal)
6. Clientes (logo grid)
7. Depoimentos (cards grandes, 2 colunas)
8. Contato (form grande + info lateral)
9. Footer (minimalista, redes sociais)

Visual:
- Muito espaço em branco
- Tipografia grande
- Imagens full-width
- Hover effects elegantes
- Paleta monocromática + 1 cor de destaque

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEMPLATE 3: SERVIÇOS PROFISSIONAIS (Advocacia, Consultoria, Saúde)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Estrutura:
1. Header (formal, logo + menu tradicional + telefone)
2. Hero (imagem de fundo + overlay escuro + texto centralizado)
3. Sobre o Escritório (2 colunas: história + valores)
4. Áreas de Atuação (grid 2x3 com ícones)
5. Equipe (cards com fotos + cargo + LinkedIn)
6. Diferenciais (lista com checkmarks)
7. Cases de Sucesso (timeline ou cards)
8. Prêmios/Certificações (badges)
9. Depoimentos (carrossel formal)
10. Contato (mapa + formulário lado a lado)
11. Footer (completo com informações legais)

Visual:
- Formal e confiável
- Cores sóbrias (azul marinho, dourado, cinza)
- Serifas em títulos (opcional)
- Fotos profissionais
- Layout tradicional mas moderno

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEMPLATE 4: E-COMMERCE / LOJA VIRTUAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Estrutura:
1. Header (logo, busca, carrinho, menu categorias)
2. Hero Banner (slider de promoções)
3. Categorias (grid 4 colunas com imagens)
4. Produtos em Destaque (grid 4 colunas com cards)
5. Banner Promocional (fullwidth)
6. Mais Vendidos (grid produtos)
7. Benefícios (frete grátis, troca fácil, etc - 4 ícones)
8. Newsletter (CTA para cadastro)
9. Instagram Feed (grid 6 fotos)
10. Footer (mega footer com categorias, info, pagamento)

Visual:
- Clean e organizado
- Ênfase em produtos
- CTAs destacados (botões de compra)
- Badges (novo, -20%, frete grátis)
- Cards com imagem grande do produto

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEMPLATE 5: RESTAURANTE / ALIMENTAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Estrutura:
1. Header (logo + menu + "Faça seu pedido")
2. Hero (imagem fullscreen do prato principal + horários)
3. Sobre o Restaurante (história + chef)
4. Cardápio (tabs: entradas, principais, sobremesas, bebidas)
5. Galeria de Pratos (grid masonry de fotos)
6. Reservas (form simples + informações)
7. Depoimentos (cards com fotos dos clientes)
8. Localização (mapa + endereço + horários)
9. Instagram (feed de fotos)
10. Footer (redes sociais + delivery apps)

Visual:
- Fotos apetitosas em destaque
- Cores quentes (laranja, vermelho, marrom)
- Tipografia elegante mas legível
- Cards de menu com preços destacados
- Ícones de delivery

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEMPLATE 6: INSTITUCIONAL / CORPORATIVO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Estrutura:
1. Header (menu completo + área do cliente)
2. Hero (slider de imagens + mensagens institucionais)
3. Números da Empresa (contador animado: anos, clientes, projetos)
4. Sobre (missão, visão, valores)
5. Serviços (grid 3 colunas)
6. Cases (cards com logo cliente + projeto)
7. Parceiros (logo carousel)
8. Blog/Notícias (últimas 3 postagens)
9. Trabalhe Conosco (CTA + benefícios)
10. Contato (múltiplos escritórios se aplicável)
11. Footer (completo com mapa do site)

Visual:
- Profissional e clean
- Azul corporativo ou cores da marca
- Muitas informações organizadas
- Gráficos e dados destacados
- Fotos de escritório/equipe

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEMPLATE 7: EDUCACIONAL / CURSO ONLINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Estrutura:
1. Header (logo + login/cadastro)
2. Hero (vídeo de introdução + CTA de matrícula)
3. O que você vai aprender (lista de módulos)
4. Instrutor (foto + bio + credenciais)
5. Conteúdo Programático (accordion de aulas)
6. Bônus Exclusivos (cards de materiais extras)
7. Garantia (selo de 7 dias)
8. Depoimentos em Vídeo (thumbnails + play button)
9. Perguntas Frequentes (accordion)
10. Oferta Final (preço + parcelamento + CTA urgência)
11. Footer (links úteis + suporte)

Visual:
- Energético e motivacional
- Vídeos e testimonials em destaque
- CTAs repetidos ao longo da página
- Contadores de tempo (escassez)
- Cores vibrantes (laranja, verde, azul)

=========================================================
🎨 COMPONENTES REUTILIZÁVEIS
=========================================================

Aqui estão os componentes premium que você pode usar em qualquer template:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. HEADER STICKY COM GLASSMORPHISM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<header x-data="{ scrolled: false, mobileOpen: false }" 
        @scroll.window="scrolled = window.scrollY > 50"
        :class="scrolled ? 'bg-white/90 backdrop-blur-lg shadow-lg' : 'bg-transparent'"
        class="fixed w-full top-0 z-50 transition-all duration-300">
  <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between items-center h-20">
      <!-- Logo -->
      <div class="flex-shrink-0">
        <a href="#" class="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          LogoMarca
        </a>
      </div>
      
      <!-- Desktop Menu -->
      <div class="hidden lg:flex items-center space-x-8">
        <a href="#home" class="text-gray-700 hover:text-primary transition-colors font-medium">Home</a>
        <a href="#sobre" class="text-gray-700 hover:text-primary transition-colors font-medium">Sobre</a>
        <a href="#servicos" class="text-gray-700 hover:text-primary transition-colors font-medium">Serviços</a>
        <a href="#contato" class="px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-full font-semibold hover:scale-105 transition-transform shadow-lg">
          Contato
        </a>
      </div>
      
      <!-- Mobile Toggle -->
      <button @click="mobileOpen = !mobileOpen" class="lg:hidden p-2">
        <i data-lucide="menu" x-show="!mobileOpen" class="w-6 h-6"></i>
        <i data-lucide="x" x-show="mobileOpen" class="w-6 h-6"></i>
      </button>
    </div>
    
    <!-- Mobile Menu -->
    <div x-show="mobileOpen" 
         x-transition:enter="transition ease-out duration-200"
         x-transition:enter-start="opacity-0 -translate-y-4"
         x-transition:enter-end="opacity-100 translate-y-0"
         class="lg:hidden pb-4 space-y-3">
      <a href="#home" class="block py-2 text-gray-700 hover:text-primary transition-colors">Home</a>
      <a href="#sobre" class="block py-2 text-gray-700 hover:text-primary transition-colors">Sobre</a>
      <a href="#servicos" class="block py-2 text-gray-700 hover:text-primary transition-colors">Serviços</a>
      <a href="#contato" class="block py-2 text-gray-700 hover:text-primary transition-colors">Contato</a>
    </div>
  </nav>
</header>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. HERO MODERNO (VARIAÇÃO 1 - GRADIENTE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<section class="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-secondary to-accent text-white overflow-hidden pt-20">
  <!-- Animated Blobs -->
  <div class="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
  <div class="absolute bottom-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" style="animation-delay: 1s;"></div>
  
  <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center" data-aos="fade-up">
    <h1 class="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
      Transforme Seu Negócio<br>
      <span class="text-yellow-300">Com Tecnologia</span>
    </h1>
    <p class="text-xl md:text-2xl mb-10 opacity-90 max-w-3xl mx-auto leading-relaxed">
      Soluções inovadoras para empresas que querem crescer e se destacar no mercado digital
    </p>
    <div class="flex flex-col sm:flex-row gap-4 justify-center">
      <a href="#contato" class="px-10 py-5 bg-white text-primary font-bold rounded-full hover:scale-105 transition-all shadow-2xl text-lg">
        Começar Agora
      </a>
      <a href="#sobre" class="px-10 py-5 bg-white/20 backdrop-blur text-white font-bold rounded-full hover:bg-white/30 transition-all border-2 border-white/30 text-lg">
        Saiba Mais
      </a>
    </div>
  </div>
  
  <!-- Scroll Indicator -->
  <div class="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
    <i data-lucide="chevron-down" class="w-8 h-8 text-white/70"></i>
  </div>
</section>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. HERO MODERNO (VARIAÇÃO 2 - SPLIT COM IMAGEM)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<section class="relative min-h-screen flex items-center bg-white pt-20">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      <!-- Texto -->
      <div data-aos="fade-right">
        <h1 class="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight text-gray-900">
          Sua Empresa no
          <span class="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Próximo Nível
          </span>
        </h1>
        <p class="text-xl text-gray-600 mb-8 leading-relaxed">
          Transforme sua presença digital com soluções personalizadas e resultados mensuráveis
        </p>
        <div class="flex flex-col sm:flex-row gap-4">
          <a href="#contato" class="px-8 py-4 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-xl hover:scale-105 transition-all shadow-lg text-center">
            Fale Conosco
          </a>
          <a href="#portfolio" class="px-8 py-4 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:border-primary hover:text-primary transition-all text-center">
            Ver Portfolio
          </a>
        </div>
      </div>
      
      <!-- Imagem -->
      <div data-aos="fade-left" data-aos-delay="200">
        <img src="https://source.unsplash.com/800x600/?business,technology" 
             alt="Equipe trabalhando" 
             class="rounded-2xl shadow-2xl w-full">
      </div>
    </div>
  </div>
</section>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. CARDS DE FEATURES (3 VARIAÇÕES)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<!-- VARIAÇÃO A: Ícone topo, hover lift -->
<div class="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300" data-aos="fade-up">
  <div class="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
    <i data-lucide="zap" class="text-white w-8 h-8"></i>
  </div>
  <h3 class="text-2xl font-bold mb-4 text-gray-900">Rapidez</h3>
  <p class="text-gray-600 leading-relaxed">Entregamos soluções ágeis sem comprometer a qualidade</p>
</div>

<!-- VARIAÇÃO B: Ícone esquerda, borda lateral -->
<div class="bg-white rounded-xl p-6 border-l-4 border-primary shadow-md hover:shadow-xl transition-all" data-aos="fade-up">
  <div class="flex items-start gap-4">
    <div class="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
      <i data-lucide="check-circle" class="text-primary w-6 h-6"></i>
    </div>
    <div>
      <h3 class="text-xl font-bold mb-2 text-gray-900">Garantia Total</h3>
      <p class="text-gray-600">Satisfação garantida ou seu dinheiro de volta</p>
    </div>
  </div>
</div>

<!-- VARIAÇÃO C: Hover reveal com gradiente -->
<div class="group relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8 overflow-hidden hover:from-primary hover:to-secondary transition-all duration-500" data-aos="zoom-in">
  <div class="relative z-10">
    <i data-lucide="shield" class="w-12 h-12 text-primary group-hover:text-white transition-colors mb-4"></i>
    <h3 class="text-2xl font-bold mb-3 text-gray-900 group-hover:text-white transition-colors">Segurança</h3>
    <p class="text-gray-600 group-hover:text-white/90 transition-colors">Seus dados protegidos com criptografia de ponta</p>
  </div>
</div>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. DEPOIMENTOS (2 VARIAÇÕES)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<!-- VARIAÇÃO A: Card com estrelas -->
<div class="bg-white rounded-2xl p-8 shadow-lg" data-aos="fade-up">
  <div class="flex items-center gap-1 mb-4">
    <i data-lucide="star" class="w-5 h-5 fill-yellow-400 text-yellow-400"></i>
    <i data-lucide="star" class="w-5 h-5 fill-yellow-400 text-yellow-400"></i>
    <i data-lucide="star" class="w-5 h-5 fill-yellow-400 text-yellow-400"></i>
    <i data-lucide="star" class="w-5 h-5 fill-yellow-400 text-yellow-400"></i>
    <i data-lucide="star" class="w-5 h-5 fill-yellow-400 text-yellow-400"></i>
  </div>
  <p class="text-gray-700 italic mb-6 leading-relaxed">
    "Trabalho excepcional! Superaram todas as minhas expectativas e entregaram antes do prazo."
  </p>
  <div class="flex items-center gap-4">
    <img src="https://ui-avatars.com/api/?name=Ana+Silva&background=6366f1&color=fff&size=64" 
         alt="Ana Silva" 
         class="w-14 h-14 rounded-full">
    <div>
      <p class="font-semibold text-gray-900">Ana Silva</p>
      <p class="text-sm text-gray-600">CEO, TechCorp</p>
    </div>
  </div>
</div>

<!-- VARIAÇÃO B: Quote grande -->
<div class="relative bg-gradient-to-br from-primary/5 to-secondary/5 rounded-2xl p-10" data-aos="fade-up">
  <i data-lucide="quote" class="absolute top-6 left-6 w-12 h-12 text-primary/20"></i>
  <p class="text-lg text-gray-700 mb-6 relative z-10 pl-8">
    Excelente experiência do início ao fim. A equipe é extremamente profissional e atenciosa.
  </p>
  <div class="flex items-center gap-3 pl-8">
    <img src="https://ui-avatars.com/api/?name=Carlos+Santos&background=8b5cf6&color=fff&size=56" 
         alt="Carlos Santos" 
         class="w-12 h-12 rounded-full">
    <div>
      <p class="font-bold text-gray-900">Carlos Santos</p>
      <p class="text-sm text-gray-600">Diretor de Marketing</p>
    </div>
  </div>
</div>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. FORMULÁRIO DE CONTATO PREMIUM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<section id="contato" class="py-24 bg-gray-50">
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-16" data-aos="fade-up">
      <h2 class="text-4xl md:text-5xl font-bold mb-4 text-gray-900">Entre em Contato</h2>
      <p class="text-xl text-gray-600">Estamos prontos para ajudar você a alcançar seus objetivos</p>
    </div>
    
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Informações de contato -->
      <div class="lg:col-span-1 space-y-6" data-aos="fade-right">
        <div class="bg-white rounded-xl p-6 shadow-md">
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <i data-lucide="mail" class="w-6 h-6 text-primary"></i>
            </div>
            <div>
              <h3 class="font-semibold text-gray-900 mb-1">Email</h3>
              <p class="text-gray-600">contato@empresa.com</p>
            </div>
          </div>
        </div>
        
        <div class="bg-white rounded-xl p-6 shadow-md">
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <i data-lucide="phone" class="w-6 h-6 text-primary"></i>
            </div>
            <div>
              <h3 class="font-semibold text-gray-900 mb-1">Telefone</h3>
              <p class="text-gray-600">(11) 99999-9999</p>
            </div>
          </div>
        </div>
        
        <div class="bg-white rounded-xl p-6 shadow-md">
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <i data-lucide="map-pin" class="w-6 h-6 text-primary"></i>
            </div>
            <div>
              <h3 class="font-semibold text-gray-900 mb-1">Endereço</h3>
              <p class="text-gray-600">Av. Paulista, 1000<br>São Paulo - SP</p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Formulário -->
      <div class="lg:col-span-2" data-aos="fade-left">
        <form class="bg-white rounded-2xl p-8 shadow-lg space-y-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Nome</label>
              <input type="text" 
                     class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors" 
                     placeholder="Seu nome completo">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input type="email" 
                     class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors" 
                     placeholder="seu@email.com">
            </div>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Telefone</label>
            <input type="tel" 
                   class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors" 
                   placeholder="(00) 00000-0000">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Mensagem</label>
            <textarea rows="5" 
                      class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors resize-none" 
                      placeholder="Como podemos ajudar você?"></textarea>
          </div>
          
          <button type="submit" 
                  class="w-full py-4 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl hover:scale-[1.02] transition-all shadow-lg">
            Enviar Mensagem
          </button>
        </form>
      </div>
    </div>
  </div>
</section>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. FAQ ACCORDION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<section class="py-24 bg-white">
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-16" data-aos="fade-up">
      <h2 class="text-4xl md:text-5xl font-bold mb-4 text-gray-900">Perguntas Frequentes</h2>
      <p class="text-xl text-gray-600">Tire suas dúvidas sobre nossos serviços</p>
    </div>
    
    <div x-data="{ active: 1 }" class="space-y-4">
      <!-- FAQ Item 1 -->
      <div class="bg-gray-50 rounded-xl overflow-hidden border-2 border-transparent hover:border-primary/20 transition-colors" data-aos="fade-up">
        <button @click="active = active === 1 ? null : 1" 
                class="w-full px-6 py-5 text-left flex justify-between items-center hover:bg-gray-100 transition-colors">
          <span class="font-semibold text-lg text-gray-900">Como funciona o processo de contratação?</span>
          <i data-lucide="chevron-down" 
             :class="active === 1 ? 'rotate-180' : ''" 
             class="w-5 h-5 text-primary transition-transform flex-shrink-0"></i>
        </button>
        <div x-show="active === 1" 
             x-transition:enter="transition ease-out duration-200"
             x-transition:enter-start="opacity-0 -translate-y-2"
             x-transition:enter-end="opacity-100 translate-y-0"
             class="px-6 pb-5">
          <p class="text-gray-600 leading-relaxed">
            O processo é simples: primeiro fazemos uma reunião para entender suas necessidades, depois apresentamos uma proposta personalizada, e após a aprovação iniciamos o projeto com acompanhamento constante.
          </p>
        </div>
      </div>
      
      <!-- FAQ Item 2 -->
      <div class="bg-gray-50 rounded-xl overflow-hidden border-2 border-transparent hover:border-primary/20 transition-colors" data-aos="fade-up" data-aos-delay="100">
        <button @click="active = active === 2 ? null : 2" 
                class="w-full px-6 py-5 text-left flex justify-between items-center hover:bg-gray-100 transition-colors">
          <span class="font-semibold text-lg text-gray-900">Qual o prazo médio de entrega?</span>
          <i data-lucide="chevron-down" 
             :class="active === 2 ? 'rotate-180' : ''" 
             class="w-5 h-5 text-primary transition-transform flex-shrink-0"></i>
        </button>
        <div x-show="active === 2" 
             x-transition:enter="transition ease-out duration-200"
             x-transition:enter-start="opacity-0 -translate-y-2"
             x-transition:enter-end="opacity-100 translate-y-0"
             class="px-6 pb-5">
          <p class="text-gray-600 leading-relaxed">
            O prazo varia conforme a complexidade do projeto, mas geralmente entregamos sites em 15 a 30 dias. Projetos maiores podem levar mais tempo, mas sempre mantemos você informado.
          </p>
        </div>
      </div>
      
      <!-- Adicione mais 4-6 FAQs seguindo o mesmo padrão -->
    </div>
  </div>
</section>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. FOOTER COMPLETO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<footer class="bg-gray-900 text-white">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
      <!-- Coluna 1: Sobre -->
      <div>
        <h3 class="text-2xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          LogoMarca
        </h3>
        <p class="text-gray-400 leading-relaxed mb-6">
          Transformando ideias em soluções digitais inovadoras desde 2020.
        </p>
        <div class="flex gap-4">
          <a href="#" class="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-primary transition-colors">
            <i data-lucide="facebook" class="w-5 h-5"></i>
          </a>
          <a href="#" class="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-primary transition-colors">
            <i data-lucide="instagram" class="w-5 h-5"></i>
          </a>
          <a href="#" class="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-primary transition-colors">
            <i data-lucide="linkedin" class="w-5 h-5"></i>
          </a>
        </div>
      </div>
      
      <!-- Coluna 2: Links Rápidos -->
      <div>
        <h4 class="font-semibold text-lg mb-4">Links Rápidos</h4>
        <ul class="space-y-3">
          <li><a href="#home" class="text-gray-400 hover:text-white transition-colors">Home</a></li>
          <li><a href="#sobre" class="text-gray-400 hover:text-white transition-colors">Sobre Nós</a></li>
          <li><a href="#servicos" class="text-gray-400 hover:text-white transition-colors">Serviços</a></li>
          <li><a href="#portfolio" class="text-gray-400 hover:text-white transition-colors">Portfolio</a></li>
          <li><a href="#contato" class="text-gray-400 hover:text-white transition-colors">Contato</a></li>
        </ul>
      </div>
      
      <!-- Coluna 3: Serviços -->
      <div>
        <h4 class="font-semibold text-lg mb-4">Serviços</h4>
        <ul class="space-y-3">
          <li><a href="#" class="text-gray-400 hover:text-white transition-colors">Desenvolvimento Web</a></li>
          <li><a href="#" class="text-gray-400 hover:text-white transition-colors">Design UI/UX</a></li>
          <li><a href="#" class="text-gray-400 hover:text-white transition-colors">Marketing Digital</a></li>
          <li><a href="#" class="text-gray-400 hover:text-white transition-colors">Consultoria</a></li>
        </ul>
      </div>
      
      <!-- Coluna 4: Contato -->
      <div>
        <h4 class="font-semibold text-lg mb-4">Contato</h4>
        <ul class="space-y-3 text-gray-400">
          <li class="flex items-start gap-3">
            <i data-lucide="mail" class="w-5 h-5 flex-shrink-0 mt-0.5"></i>
            <span>contato@empresa.com</span>
          </li>
          <li class="flex items-start gap-3">
            <i data-lucide="phone" class="w-5 h-5 flex-shrink-0 mt-0.5"></i>
            <span>(11) 99999-9999</span>
          </li>
          <li class="flex items-start gap-3">
            <i data-lucide="map-pin" class="w-5 h-5 flex-shrink-0 mt-0.5"></i>
            <span>Av. Paulista, 1000<br>São Paulo - SP</span>
          </li>
        </ul>
      </div>
    </div>
    
    <!-- Linha divisória e copyright -->
    <div class="border-t border-gray-800 pt-8 text-center">
      <p class="text-gray-400">
        © <span id="ano"></span> LogoMarca. Todos os direitos reservados.
      </p>
    </div>
  </div>
</footer>

=========================================================
🔎 SEO COMPLETO
=========================================================
No <head>, SEMPRE inclua (adapte ao contexto do projeto):

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>[Título otimizado com palavra-chave principal]</title>
<meta name="description" content="[150-160 caracteres descritivos e persuasivos]">
<meta name="keywords" content="[5-10 palavras-chave relevantes]">
<link rel="canonical" href="https://seusite.com">

<!-- Open Graph (Facebook/LinkedIn) -->
<meta property="og:title" content="[Título atraente]">
<meta property="og:description" content="[Descrição persuasiva]">
<meta property="og:image" content="https://source.unsplash.com/1200x630/?[tema-relevante]">
<meta property="og:url" content="https://seusite.com">
<meta property="og:type" content="website">
<meta property="og:site_name" content="[Nome da Empresa]">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="[Título]">
<meta name="twitter:description" content="[Descrição]">
<meta name="twitter:image" content="https://source.unsplash.com/1200x630/?[tema-relevante]">

<meta name="language" content="pt-BR">
<meta name="robots" content="index, follow">
<meta name="author" content="[Nome da Empresa]">

=========================================================
🎬 SCRIPTS FINAIS (antes de </body>)
=========================================================

<script>
// Inicializa AOS com configurações otimizadas
AOS.init({ 
  duration: 800, 
  once: true, 
  offset: 100,
  easing: 'ease-out-cubic'
});

// Inicializa Lucide icons
lucide.createIcons();

// Ano dinâmico no footer
document.getElementById('ano').textContent = new Date().getFullYear();

// Smooth scroll para âncoras
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      const offsetTop = target.offsetTop - 80; // Compensa header fixo
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      });
    }
  });
});

// Lazy loading de imagens (opcional, mas recomendado)
if ('loading' in HTMLImageElement.prototype) {
  const images = document.querySelectorAll('img[loading="lazy"]');
  images.forEach(img => {
    img.src = img.dataset.src || img.src;
  });
} else {
  // Fallback para navegadores antigos
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lazysizes/5.3.2/lazysizes.min.js';
  document.body.appendChild(script);
}
</script>

=========================================================
✅ CHECKLIST DE QUALIDADE
=========================================================

ANTES de gerar o código final, verifique:

☐ Template escolhido é adequado ao tipo de negócio
☐ Cores primária/secundária contextuais ao nicho
☐ TODAS as imagens usam URLs confiáveis (source.unsplash.com ou picsum)
☐ Todas as CDNs incluídas (Tailwind, Alpine, AOS, Lucide, Google Fonts)
☐ SEO completo com tags OG e Twitter Card
☐ Todas as seções do template estão presentes
☐ AOS.init() e lucide.createIcons() nos scripts finais
☐ Ano dinâmico funcionando
☐ Menu mobile com Alpine.js funcional
☐ Smooth scroll configurado
☐ Responsivo em mobile, tablet e desktop
☐ Hover effects em cards e botões
☐ CTAs claros e destacados
☐ Formulários com labels e placeholders
☐ Footer completo com informações de contato
☐ Sem erros de sintaxe HTML
☐ Espaçamento consistente (py-24 para seções)
☐ Hierarquia tipográfica clara
☐ Contraste de cores adequado (acessibilidade)

=========================================================
🚀 INSTRUÇÕES FINAIS
=========================================================

1. ANALISE o prompt do cliente
2. DETERMINE o tipo de negócio
3. ESCOLHA o template adequado
4. DEFINA a paleta de cores contextual
5. GERE o HTML completo do início (<!DOCTYPE html>) ao fim (</html>)
6. RETORNE APENAS O CÓDIGO (sem explicações, sem markdown)

O resultado deve ser um site que:
- Parece ter custado $10,000+
- Compete com Lovable, Webflow e Framer
- Funciona perfeitamente em todos os dispositivos
- Tem todas as imagens carregando corretamente
- É visualmente distinto de outros sites gerados
- Reflete a identidade do negócio do cliente

DESCRIÇÃO DO PROJETO DO CLIENTE:
${prompt}

GERE O HTML COMPLETO AGORA.
            `;



        // =========================================================
        // ✏️ PROMPT PARA EDIÇÃO (QUANDO JÁ EXISTE HTML)
        // =========================================================
        const systemPromptEdicao = `
                Você é um desenvolvedor web especialista em EDITAR e MANTER sites premium existentes.

                ⚠️ RETORNE APENAS O HTML COMPLETO ATUALIZADO (sem markdown, sem explicações, sem \`\`\`html).

                =========================================================
                ⚠️ MODO EDIÇÃO ATIVADO - REGRAS CRÍTICAS
                =========================================================

                🔒 PRESERVE 100% (não toque a menos que seja explicitamente solicitado):
                - Toda a estrutura HTML existente
                - Todas as bibliotecas CDN (Tailwind, Alpine, AOS, Lucide)
                - Todas as classes CSS e estilos inline
                - Todos os scripts e funcionalidades JavaScript
                - Todas as seções, imagens, textos e componentes
                - Todo o Design System aplicado (cores, tipografia, espaçamentos)
                - Todos os menus, navegação e interatividade
                - Todas as animações e efeitos
                - Todo o SEO (meta tags)

                ✅ MODIFIQUE APENAS:
                - O que foi EXPLICITAMENTE solicitado no prompt do cliente
                - Mantenha o padrão visual e de código do site atual

                ❌ NUNCA FAÇA:
                - Remover seções inteiras sem solicitação
                - Simplificar o código
                - Remover bibliotecas CDN
                - Alterar estrutura geral
                - Mudar paleta de cores (a menos que solicitado)
                - Quebrar funcionalidades existentes
                - Remover animações ou efeitos

                🎯 COMO EDITAR CORRETAMENTE:

                Exemplo 1: "mude o título do hero para X"
                → Encontre apenas o <h1> do hero
                → Altere apenas o texto
                → Preserve todas as classes e estrutura

                Exemplo 2: "adicione uma nova seção de benefícios"
                → Insira a nova seção no local apropriado
                → Use o mesmo padrão visual do site (cores, tipografia, espaçamentos)
                → Mantenha as outras seções intactas

                Exemplo 3: "mude a cor do botão do CTA para verde"
                → Encontre o botão específico
                → Altere apenas as classes de cor (ex: bg-indigo-600 → bg-green-600)
                → Preserve hover effects e estrutura

                🔄 FLUXO DE EDIÇÃO:
                1. Leia o HTML atual completamente
                2. Identifique EXATAMENTE o que mudar baseado no prompt
                3. Faça a mudança cirúrgica (apenas o necessário)
                4. Retorne o HTML COMPLETO com a modificação

                =========================================================
                📋 HTML ATUAL DO SITE
                =========================================================
                ${baseHTML}

                =========================================================
                📝 SOLICITAÇÃO DO CLIENTE
                =========================================================
                ${prompt}

                =========================================================
                🎯 TAREFA
                =========================================================
                Analise o HTML atual e faça APENAS as modificações solicitadas pelo cliente.
                Preserve TODO o resto do site intacto.
                Retorne o HTML COMPLETO atualizado (do <!DOCTYPE html> até </html>).
                `;

        // =========================================================
        // 🎯 SELECIONA O PROMPT CORRETO
        // =========================================================
        const systemPrompt = isEditing ? systemPromptEdicao : systemPromptCriacao;

        let html = "";

        // ✅ Seleciona modelo de IA
        if (USE_GEMINI) {
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
            const result = await model.generateContent(systemPrompt);
            html = result.response.text();
            return limparRetorno(html);
        } else {
            // Claude API
            const stream = await anthropic.messages.stream({
                model: "claude-sonnet-4-5-20250929",
                max_tokens: 60000,
                system: systemPrompt, // Instruções gerais curtas
                messages: [{
                    role: "user",
                    content: systemPrompt
                }]
            });


            let html = "";

            // ===========================================
            // 2. LÊ O STREAM (gerando o HTML)
            // ===========================================
            for await (const event of stream) {
                if (event.type === "content_block_delta" && event.delta?.text) {
                    html += event.delta.text;
                }
            }

            // ===========================================
            // 3. APÓS terminar o stream, pega o usage real
            // ===========================================
            const finalMessage = await stream.finalMessage();

            const inputTokens = finalMessage.usage?.input_tokens ?? 0;
            const outputTokens = finalMessage.usage?.output_tokens ?? 0;

            console.log("============== TOKEN USAGE REAL ==============");
            console.log("Tokens de entrada:", inputTokens);
            console.log("Tokens de saída:", outputTokens);
            console.log("Total:", inputTokens + outputTokens);
            console.log("===============================================");

            await uso_creditos(userId, inputTokens + outputTokens, inputTokens + outputTokens, id_projeto);

            // ===========================================
            // 4. Retorna HTML pronto
            // ===========================================
            console.log("##==> HTML FINAL GERADO ENVIANDO PARA DIRECT ADMIN");
            return limparRetorno(html);
        }


    } catch (error) {
        console.error("Erro ao gerar parte do site:", error);
        if (error?.error?.message) console.error("Mensagem do modelo:", error.error.message);
        if (error?.requestID) console.error("ID da requisição:", error.requestID);
        return "<!-- Erro ao gerar conteúdo -->" + error;
    }
}
