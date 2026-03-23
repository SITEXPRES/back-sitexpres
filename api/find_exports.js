import fs from 'fs';

const code = fs.readFileSync('controllers/InterControllers.js', 'utf8');
const lines = code.split('\n');

const exportsList = [];
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('export ')) {
        exportsList.push("Line " + (i+1) + ": " + lines[i].substring(0, 80));
    }
}
console.log('--- EXPORTS IN InterControllers.js ---');
console.log(exportsList.join('\n'));
