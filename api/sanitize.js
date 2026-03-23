import fs from 'fs';

for (let file of ['controllers/InterControllers.js', 'controllers/paypalController.js']) {
    let content = fs.readFileSync(file, 'utf8');
    // Normalize newlines to \n
    content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Remove double blank lines
    content = content.replace(/\n{3,}/g, '\n\n');
    fs.writeFileSync(file, content);
}
console.log('Sanitized files');
