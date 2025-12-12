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
        const systemPromptCriacao = `
            Você é um designer e desenvolvedor web SÊNIOR especializado em criar interfaces PREMIUM comparáveis ao Lovable, Webflow e Framer.
            Seu objetivo é gerar HTML standalone que pareça um produto profissional de $10,000+.

            ⚠️ RETORNE APENAS CÓDIGO HTML COMPLETO (sem markdown, sem explicações, sem \`\`\`html).

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
                    primary: '#6366f1',
                    secondary: '#8b5cf6',
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
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">

            <!-- Lucide Icons -->
            <script src="https://unpkg.com/lucide@latest"></script>

            <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Inter', sans-serif; 
                overflow-x: hidden;
                scroll-behavior: smooth;
            }
            </style>

            =========================================================
            🎨 DESIGN SYSTEM PREMIUM
            =========================================================

            🎭 VISUAL:
            - Gradientes vibrantes (ex: from-indigo-600 to-purple-600)
            - Glassmorphism: bg-white/80 backdrop-blur-md
            - Sombras suaves: shadow-lg hover:shadow-2xl
            - Bordas arredondadas: rounded-2xl

            ✨ TIPOGRAFIA:
            - Títulos: text-4xl md:text-5xl lg:text-6xl font-bold
            - Subtítulos: text-xl md:text-2xl font-semibold
            - Corpo: text-base md:text-lg leading-relaxed
            - Gradiente em texto: bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent

            🏗️ LAYOUT:
            - Containers: max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
            - Seções: py-16 sm:py-20 lg:py-24
            - Grid: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8
            - Flex: flex items-center justify-center

            💎 COMPONENTES OBRIGATÓRIOS:

            1. HEADER/NAV (sticky + glassmorphism):
            <header class="fixed w-full top-0 z-50 bg-white/80 backdrop-blur-md shadow-sm">
            <nav x-data="{ open: false }" class="max-w-7xl mx-auto px-4 py-4">
                <div class="flex justify-between items-center">
                <div class="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Logo
                </div>
                <!-- Desktop menu -->
                <div class="hidden lg:flex space-x-8">
                    <a href="#home" class="hover:text-indigo-600 transition">Home</a>
                    <a href="#sobre" class="hover:text-indigo-600 transition">Sobre</a>
                    <a href="#servicos" class="hover:text-indigo-600 transition">Serviços</a>
                    <a href="#contato" class="hover:text-indigo-600 transition">Contato</a>
                </div>
                <!-- Mobile toggle -->
                <button @click="open = !open" class="lg:hidden">
                    <i data-lucide="menu" x-show="!open" class="w-6 h-6"></i>
                    <i data-lucide="x" x-show="open" class="w-6 h-6"></i>
                </button>
                </div>
                <!-- Mobile menu -->
                <div x-show="open" x-transition class="lg:hidden mt-4 space-y-4">
                <a href="#home" class="block hover:text-indigo-600">Home</a>
                <a href="#sobre" class="block hover:text-indigo-600">Sobre</a>
                <a href="#servicos" class="block hover:text-indigo-600">Serviços</a>
                <a href="#contato" class="block hover:text-indigo-600">Contato</a>
                </div>
            </nav>
            </header>

            2. HERO PREMIUM (fullscreen + gradient):
            <section id="home" class="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white overflow-hidden pt-20">
            <!-- Decorative blobs -->
            <div class="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
            <div class="absolute bottom-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
            
            <div class="relative z-10 max-w-7xl mx-auto px-4 text-center" data-aos="fade-up">
                <h1 class="text-5xl md:text-6xl lg:text-7xl font-bold mb-6">
                Título Impactante Aqui
                </h1>
                <p class="text-xl md:text-2xl mb-8 opacity-90 max-w-3xl mx-auto">
                Subtítulo explicativo que gera curiosidade e interesse
                </p>
                <div class="flex flex-col sm:flex-row gap-4 justify-center">
                <button class="px-8 py-4 bg-white text-indigo-600 font-semibold rounded-full hover:scale-105 transition-all shadow-xl">
                    Começar Agora
                </button>
                <button class="px-8 py-4 bg-white/20 backdrop-blur text-white font-semibold rounded-full hover:bg-white/30 transition-all border border-white/30">
                    Saiba Mais
                </button>
                </div>
            </div>
            </section>

            3. FEATURES (grid com cards):
            <section class="py-24 bg-gray-50">
            <div class="max-w-7xl mx-auto px-4">
                <div class="text-center mb-16" data-aos="fade-up">
                <h2 class="text-4xl md:text-5xl font-bold mb-4">Nossos Diferenciais</h2>
                <p class="text-xl text-gray-600">Por que escolher nossos serviços</p>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <!-- Card exemplo -->
                <div class="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300" data-aos="fade-up" data-aos-delay="100">
                    <div class="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <i data-lucide="zap" class="text-indigo-600 w-7 h-7"></i>
                    </div>
                    <h3 class="text-2xl font-bold mb-4">Rápido</h3>
                    <p class="text-gray-600 leading-relaxed">Soluções ágeis e eficientes para o seu negócio.</p>
                </div>
                
                <!-- Repita para mais cards (mínimo 3, ideal 6) -->
                </div>
            </div>
            </section>

            4. SOBRE (2 colunas):
            <section id="sobre" class="py-24 bg-white">
            <div class="max-w-7xl mx-auto px-4">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div data-aos="fade-right">
                    <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80" 
                        alt="Equipe trabalhando" 
                        class="rounded-2xl shadow-2xl">
                </div>
                <div data-aos="fade-left">
                    <h2 class="text-4xl md:text-5xl font-bold mb-6">Sobre Nós</h2>
                    <p class="text-lg text-gray-600 mb-6 leading-relaxed">
                    Texto sobre a empresa, missão, valores e diferenciais.
                    </p>
                    <ul class="space-y-4">
                    <li class="flex items-start">
                        <i data-lucide="check-circle" class="text-green-500 w-6 h-6 mr-3 flex-shrink-0 mt-1"></i>
                        <span class="text-gray-700">Benefício ou característica importante</span>
                    </li>
                    <!-- Mais itens -->
                    </ul>
                </div>
                </div>
            </div>
            </section>

            5. SERVIÇOS/PRODUTOS (cards premium):
            <section id="servicos" class="py-24 bg-gradient-to-br from-gray-50 to-gray-100">
            <div class="max-w-7xl mx-auto px-4">
                <div class="text-center mb-16" data-aos="fade-up">
                <h2 class="text-4xl md:text-5xl font-bold mb-4">Nossos Serviços</h2>
                <p class="text-xl text-gray-600">Soluções completas para o seu negócio</p>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <!-- Card serviço -->
                <div class="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all" data-aos="zoom-in">
                    <div class="h-48 bg-gradient-to-br from-indigo-500 to-purple-600"></div>
                    <div class="p-8">
                    <h3 class="text-2xl font-bold mb-4">Nome do Serviço</h3>
                    <p class="text-gray-600 mb-6">Descrição do serviço oferecido.</p>
                    <button class="text-indigo-600 font-semibold hover:underline">Saiba mais →</button>
                    </div>
                </div>
                <!-- Repita para mais serviços -->
                </div>
            </div>
            </section>

            6. DEPOIMENTOS (carousel):
            <section class="py-24 bg-white">
            <div class="max-w-7xl mx-auto px-4">
                <div class="text-center mb-16" data-aos="fade-up">
                <h2 class="text-4xl md:text-5xl font-bold mb-4">O Que Dizem Nossos Clientes</h2>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div class="bg-gray-50 rounded-2xl p-8" data-aos="fade-up">
                    <div class="flex items-center mb-4">
                    <img src="https://ui-avatars.com/api/?name=João+Silva&background=6366f1&color=fff&size=64" 
                        alt="João Silva" 
                        class="w-12 h-12 rounded-full mr-4">
                    <div>
                        <p class="font-semibold">João Silva</p>
                        <p class="text-sm text-gray-600">CEO, Empresa X</p>
                    </div>
                    </div>
                    <p class="text-gray-700 italic">"Depoimento positivo sobre o serviço prestado."</p>
                </div>
                <!-- Mais depoimentos -->
                </div>
            </div>
            </section>

            7. FAQ (accordion Alpine.js):
            <section class="py-24 bg-gray-50">
            <div class="max-w-4xl mx-auto px-4">
                <div class="text-center mb-16" data-aos="fade-up">
                <h2 class="text-4xl md:text-5xl font-bold mb-4">Perguntas Frequentes</h2>
                </div>
                
                <div x-data="{ active: null }" class="space-y-4">
                <div class="bg-white rounded-xl shadow-md overflow-hidden" data-aos="fade-up">
                    <button @click="active = active === 1 ? null : 1" 
                            class="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-50 transition">
                    <span class="font-semibold text-lg">Pergunta 1?</span>
                    <i data-lucide="chevron-down" :class="active === 1 ? 'rotate-180' : ''" 
                        class="w-5 h-5 transition-transform"></i>
                    </button>
                    <div x-show="active === 1" x-transition class="px-6 pb-4">
                    <p class="text-gray-600">Resposta detalhada aqui.</p>
                    </div>
                </div>
                <!-- Mais FAQs (mínimo 5) -->
                </div>
            </div>
            </section>

            8. CTA FINAL:
            <section class="py-24 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
            <div class="max-w-4xl mx-auto px-4 text-center" data-aos="zoom-in">
                <h2 class="text-4xl md:text-5xl font-bold mb-6">Pronto Para Começar?</h2>
                <p class="text-xl mb-8 opacity-90">Entre em contato agora mesmo e transforme seu negócio</p>
                <button class="px-10 py-5 bg-white text-indigo-600 font-bold rounded-full hover:scale-105 transition-all shadow-2xl text-lg">
                Fale Conosco Agora
                </button>
            </div>
            </section>

            9. CONTATO (form):
            <section id="contato" class="py-24 bg-white">
            <div class="max-w-4xl mx-auto px-4">
                <div class="text-center mb-16" data-aos="fade-up">
                <h2 class="text-4xl md:text-5xl font-bold mb-4">Entre em Contato</h2>
                <p class="text-xl text-gray-600">Estamos prontos para ajudar você</p>
                </div>
                
                <form class="space-y-6" data-aos="fade-up" data-aos-delay="200">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <input type="text" placeholder="Nome" 
                        class="px-6 py-4 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition">
                    <input type="email" placeholder="E-mail" 
                        class="px-6 py-4 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition">
                </div>
                <textarea rows="5" placeholder="Mensagem" 
                            class="w-full px-6 py-4 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition"></textarea>
                <button type="submit" 
                        class="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:scale-[1.02] transition-all shadow-lg">
                    Enviar Mensagem
                </button>
                </form>
            </div>
            </section>

            10. FOOTER:
            <footer class="bg-gray-900 text-white py-12">
            <div class="max-w-7xl mx-auto px-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <div>
                    <h3 class="text-2xl font-bold mb-4">Logo</h3>
                    <p class="text-gray-400">Breve descrição da empresa</p>
                </div>
                <div>
                    <h4 class="font-semibold mb-4">Links Rápidos</h4>
                    <ul class="space-y-2 text-gray-400">
                    <li><a href="#home" class="hover:text-white transition">Home</a></li>
                    <li><a href="#sobre" class="hover:text-white transition">Sobre</a></li>
                    <li><a href="#servicos" class="hover:text-white transition">Serviços</a></li>
                    </ul>
                </div>
                <div>
                    <h4 class="font-semibold mb-4">Contato</h4>
                    <ul class="space-y-2 text-gray-400">
                    <li>contato@empresa.com</li>
                    <li>(11) 99999-9999</li>
                    </ul>
                </div>
                </div>
                <div class="border-t border-gray-800 pt-8 text-center text-gray-400">
                <p>© <span id="ano"></span> Nome da Empresa. Todos os direitos reservados.</p>
                </div>
            </div>
            </footer>

            <!-- SCRIPTS FINAIS -->
            <script>
            // Inicializa AOS
            AOS.init({ duration: 800, once: true, offset: 100 });
            
            // Inicializa Lucide icons
            lucide.createIcons();
            
            // Ano dinâmico
            document.getElementById('ano').textContent = new Date().getFullYear();
            
            // Smooth scroll
            document.querySelectorAll('a[href^="#"]').forEach(anchor => {
                anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                });
            });
            </script>

            =========================================================
            🔎 SEO COMPLETO
            =========================================================
            No <head>, SEMPRE inclua:

            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>[Título otimizado baseado no prompt]</title>
            <meta name="description" content="[150-160 caracteres descritivos]">
            <link rel="canonical" href="https://seusite.com">

            <!-- Open Graph -->
            <meta property="og:title" content="[Título]">
            <meta property="og:description" content="[Descrição]">
            <meta property="og:image" content="https://images.unsplash.com/photo-[relevante]?w=1200&q=80">
            <meta property="og:url" content="https://seusite.com">
            <meta property="og:type" content="website">

            <!-- Twitter Card -->
            <meta name="twitter:card" content="summary_large_image">
            <meta name="twitter:title" content="[Título]">
            <meta name="twitter:description" content="[Descrição]">
            <meta name="twitter:image" content="https://images.unsplash.com/photo-[relevante]?w=1200&q=80">

            <meta name="language" content="pt-BR">

            =========================================================
            📸 IMAGENS
            =========================================================
            - Use Unsplash com temas relevantes: https://images.unsplash.com/photo-[ID]?w=1200&q=80
            - Sempre com alt descritivo
            - Sempre com loading="lazy" (exceto hero)
            - Use srcset quando possível

            =========================================================
            🎯 CHECKLIST FINAL
            =========================================================
            ☐ Todas as CDNs incluídas (Tailwind, Alpine, AOS, Lucide)
            ☐ AOS.init() no script final
            ☐ lucide.createIcons() incluído
            ☐ Ano dinâmico funcionando
            ☐ Menu mobile com Alpine.js
            ☐ Todas as 10 seções presentes
            ☐ SEO completo
            ☐ Animações AOS em elementos principais
            ☐ Gradientes modernos
            ☐ Responsivo (mobile-first)
            ☐ Cards com hover effects
            ☐ CTAs destacados

            =========================================================
            🎯 OBJETIVO
            =========================================================
            Crie um site que pareça ter custado $10,000+.
            Cada seção deve ser visualmente impressionante.
            O resultado deve competir com Lovable/Webflow/Framer.

            DESCRIÇÃO DO PROJETO:
            ${prompt}

            GERE O HTML COMPLETO AGORA (<!DOCTYPE html> até </html>).
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
                model: "claude-haiku-4-5-20251001",
                max_tokens: 22000,
                system: "Você é um especialista em criar e editar sites HTML premium. Sempre retorne apenas código HTML puro sem markdown.",
                messages: [{ role: "user", content: systemPrompt }]
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
