import fs from 'fs';
let code = fs.readFileSync('controllers/paypalController.js', 'utf8');
code = code.replace(/await\s+const clientHtml/g, 'const clientHtml');
fs.writeFileSync('controllers/paypalController.js', code);
console.log('Fixed syntax error');
