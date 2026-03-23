import fs from 'fs';

let interCode = fs.readFileSync('controllers/InterControllers.js', 'utf8');
if (!interCode.includes('import { buildStyledEmail }')) {
    interCode = interCode.replace('import { sendMail } from "../services/emailService.js";', 'import { sendMail } from "../services/emailService.js";\nimport { buildStyledEmail } from "../services/emailTemplateBuilder.js";');
}
fs.writeFileSync('controllers/InterControllers.js', interCode);

let paypalCode = fs.readFileSync('controllers/paypalController.js', 'utf8');
if (!paypalCode.includes('import { buildStyledEmail }')) {
    paypalCode = paypalCode.replace("import { sendMail } from '../services/emailService.js';", "import { sendMail } from '../services/emailService.js';\nimport { buildStyledEmail } from '../services/emailTemplateBuilder.js';");
}
fs.writeFileSync('controllers/paypalController.js', paypalCode);
console.log('Imports added successfully.');
