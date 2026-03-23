# Dockerfile
FROM node:20-alpine

WORKDIR /app

# Instalação do PHP e extensões necessárias para a nota fiscal nacional
RUN apk add --no-cache php php-cli php-curl php-mbstring php-xml php-json php-openssl php-phar php-dom

COPY package*.json ./
RUN npm install

COPY . .

# Certifica que dotenv vai ler o .env
ENV NODE_ENV=production

CMD ["node", "server.js"]
