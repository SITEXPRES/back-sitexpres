# Dockerfile
FROM node:20-alpine

WORKDIR /app

# Instalação do PHP e extensões necessárias para a nota fiscal nacional + libc6-compat para binários nativos
RUN apk add --no-cache libc6-compat php php-cli php-curl php-mbstring php-xml php-json php-openssl php-phar php-dom

COPY package*.json ./
RUN npm install

COPY . .

# Pré-instala as dependências do vite-base para os builds dos sites serem instantâneos
RUN cd templates/vite-base && rm -rf node_modules package-lock.json && npm install --include=dev && chmod -R +x node_modules/.bin || true
RUN mkdir -p /app/tmp && chmod 777 /app/tmp

# Certifica que dotenv vai ler o .env
ENV NODE_ENV=production

CMD ["node", "server.js"]
