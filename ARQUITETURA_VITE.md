# Arquitetura de Geração de Sites (React + Vite)

Este documento descreve a nova arquitetura do backend (`back-sitexpres`) para a geração de sites utilizando React, Vite, Tailwind v4 e Shadcn UI.

## Visão Geral do Fluxo

1. **Recebimento do Prompt (`siteController.js`)**: O usuário envia um prompt. O sistema verifica se o usuário tem limite e se é uma criação (primeira vez) ou edição.
2. **Geração via IA (`gerar_siteController.js`)**: 
   - A IA (Claude 3.5 Sonnet) atua como um Engenheiro UX.
   - O prompt do sistema instrui a IA a gerar componentes React utilizando Shadcn UI e TailwindCSS, focando principalmente no conteúdo de `App.jsx`.
   - A IA não retorna mais um HTML cru, mas sim os arquivos necessários (ou o código que será injetado no template base).
3. **Build Local (Node.js)**:
   - O servidor copia a pasta `api/templates/vite-base` para uma pasta temporária (ex: `api/tmp/{id_projeto}`).
   - O código React gerado pela IA é salvo dentro de `src/App.jsx` dessa pasta.
   - O Node.js executa `npm install` e `npm run build` na pasta temporária.
   - Os assets gerados (HTML, CSS, JS minificados) vão para a pasta `dist`.
4. **Deploy no DirectAdmin (`integracao_directadmin.js`)**:
   - A função `enviarDiretorioSubdominio` conecta via FTP e faz o upload da pasta `dist` inteira para o servidor do DirectAdmin.
5. **Salvar no Banco (`siteController.js`)**:
   - Em vez de salvar o HTML de saída final no banco, o sistema salva o **código fonte React** (`App.jsx`). Isso é crucial para que, em futuras edições, a IA possa ler o componente React que ela mesma criou e modificá-lo corretamente.
6. **Limpeza**: A pasta temporária é excluída.

## Estrutura do Template Base (`api/templates/vite-base`)

- `package.json`: Contém dependências como `react`, `react-dom`, `@tailwindcss/vite`, `framer-motion`, `lucide-react`, `clsx`, e `tailwind-merge`.
- `vite.config.js`: Configurado com alias `@/` para a pasta `src` e plugin do Tailwind v4.
- `src/index.css`: Contém variáveis CSS requeridas pelos componentes do Shadcn UI.
- `src/lib/utils.js`: Função utilitária `cn` usada nos componentes Shadcn UI.
- `index.html`: Base simples com a div `#root` onde o React será montado.

## Tratamento de Erros e Preview
- Se houver falha no build (`npm run build`), o backend intercepta o erro, cria um arquivo `index.html` de falha na pasta `dist/` explicando o erro, e faz o upload desse arquivo para que o erro seja exibido no preview do usuário.
- O progresso de stream (percentual) é atualizado com base no tamanho do código retornado pela IA, e apenas atinge 100% após a finalização do build e deploy FTP.

## Vantagens desta Abordagem
- **Design Sustentável**: A IA programa em React, o que evita quebra de tags que é comum em HTML cru.
- **Componentes Premium**: Fácil injeção de bibliotecas como Framer Motion.
- **Pronto para Exportação**: O projeto gerado é um projeto front-end moderno. Se o usuário quiser o código fonte, basta zipar o projeto.
