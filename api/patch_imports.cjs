const fs = require('fs');
const file = 'controllers/siteController.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Import enviarDiretorioSubdominio
content = content.replace(
  /import { criarSubdominioDirectAdmin, enviarHTMLSubdominio, subdominioExiste, deletarSubdominioDirectAdmin } from "\.\/integracao_directadmin\.js";/,
  'import { criarSubdominioDirectAdmin, enviarHTMLSubdominio, subdominioExiste, deletarSubdominioDirectAdmin, enviarDiretorioSubdominio } from "./integracao_directadmin.js";'
);

// 2. Fix the require fsPromises
content = content.replace(/const fsPromises = require\('fs\/promises'\);\s*await fsPromises\.rm/g, 'await fs.rm');

fs.writeFileSync(file, content);
