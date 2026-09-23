const fs = require('fs');
const file = 'controllers/gerar_siteController_vite.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "if (prompt.toLowerCase().includes('[teste]')) {",
  "let reactCode = '';\n    const tStream = Date.now();\n    if (prompt.toLowerCase().includes('[teste]')) {"
);

fs.writeFileSync(file, content);
