# 🚀 Guia de Deploy para Produção

Este documento serve como um checklist para quando você for pegar este ambiente local (com Docker) e subir para o seu servidor VPS oficial em produção (ex: Hostinger, AWS, DigitalOcean).

---

## 1. Variáveis de Ambiente (`.env`)
Antes de rodar a API no servidor, você precisará ajustar o arquivo `api/.env`.

- **DB_HOST**: Em produção, se o seu banco rodar fora do contêiner da API ou se for um servidor dedicado, troque `localhost` pelo IP real da sua VPS (ex: `143.208.9.232`).
- **POSTGRES_PORT**: No ambiente local usamos `15432` por causa de conflitos. Em produção, você pode voltar para a porta padrão `5432` (desde que ela esteja livre).
- **POSTGRES_PASSWORD**: Deixamos a senha como `'@#sitex2025#new'` com aspas simples para o Docker local não quebrar. Em produção, garanta que a senha seja forte e, caso use docker-compose, mantenha as aspas se usar o caractere `#`.
- **JWT_SECRET**: **MUDE O SEGREDO JWT!** Nunca use a mesma chave JWT do ambiente local no ambiente de produção para evitar que tokens locais sejam válidos lá.

---

## 2. Banco de Dados (PostgreSQL)
Seu banco de dados em produção foi desativado, então você precisará gerar as tabelas do zero na VPS.

**Como subir o banco de dados na VPS:**
1. Na VPS, clone o seu projeto.
2. Na pasta `api`, rode `docker compose up -d postgres` para criar o banco de dados oficial.
3. Para criar a estrutura completa das tabelas, você precisará levar o script `setup_local_db.js` (que nós usamos localmente) e rodar ele **UMA ÚNICA VEZ** lá na VPS:
   ```bash
   node setup_local_db.js
   ```
4. *Opcional:* Se você já tiver clientes ou dados no banco local e quiser levar para a VPS, será necessário fazer um dump SQL:
   ```bash
   # Rodar localmente para exportar:
   docker exec -t postgres-admin pg_dump -U adminsitexpress db_sitexpress > backup.sql
   
   # Na VPS para importar:
   cat backup.sql | docker exec -i <nome_do_container_vps> psql -U adminsitexpress -d db_sitexpress
   ```

---

## 3. Segurança e CORS (Frontend)
No seu arquivo `server.js`, existe uma lista de URLs autorizadas (CORS):
```javascript
origin: ['http://localhost:8080', 'https://seusitefrontend.com', 'https://app.sitexpres.com.br', 'https://site-ai-launchpad.lovable.app']
```
- Antes de publicar, certifique-se de que o seu domínio real de produção (`https://app.sitexpres.com.br`) está correto.
- Você pode remover o `http://localhost:8080` se não for mais utilizar o servidor como dev.

---

## 4. Subindo a API
Em vez de usar `npm start` solto no terminal da VPS, certifique-se de usar um gerenciador de processos como o **PM2** para que sua API não desligue quando você fechar a janela do terminal (SSH).

```bash
# Instalando o PM2 globalmente na VPS
npm install -g pm2

# Rodando a API
pm2 start server.js --name "sitexpress-api"

# Para salvar para que ela reinicie sozinha se o servidor VPS for reiniciado
pm2 save
pm2 startup
```

---

## 5. Dicas Finais
- Fique de olho no arquivo `cron_notificacoes.js`. Em produção, garantir que ele esteja sendo chamado no intervalo correto via `crontab` do Linux ou pelo próprio PM2 é essencial para cobrar assinaturas automaticamente.
