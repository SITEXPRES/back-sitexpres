import fs from 'fs';

let pCode = fs.readFileSync('controllers/paypalController.js', 'utf8');
pCode = pCode.replace(/Link da Nota Fiscal:/g, 'Link de Consulta:');
pCode = pCode.replace(/Link Nota Fiscal:/g, 'Link de Consulta:');
fs.writeFileSync('controllers/paypalController.js', pCode);

let iCode = fs.readFileSync('controllers/InterControllers.js', 'utf8');
iCode = iCode.replace(/Link da Nota Fiscal:/g, 'Link de Consulta:');
iCode = iCode.replace(/Link Nota Fiscal:/g, 'Link de Consulta:');
fs.writeFileSync('controllers/InterControllers.js', iCode);

console.log('Fixed wording');
