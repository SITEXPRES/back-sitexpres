const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'controllers');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
files.push('../routes/userRoutes.js');
files.push('../routes/siteRoutes.js');
files.push('../routes/webhookRoutes.js');
const queries = [];
files.forEach(f => {
  const p = f.startsWith('..') ? path.join(__dirname, f) : path.join(dir, f);
  if(!fs.existsSync(p)) return;
  const content = fs.readFileSync(p, 'utf8');
  // Simple regex to extract query strings (handles backticks)
  const matches = content.match(/query\(\s*[\`\'\"]([\s\S]*?)[\`\'\"]/g);
  if (matches) {
    matches.forEach(m => {
        let q = m.substring(6).trim();
        q = q.replace(/^[\`\'\"]/, ''); // remove first quote
        queries.push({file: f, query: q});
    });
  }
});
console.log('Total queries:', queries.length);
queries.forEach(q => {
  if (q.query.match(/INSERT|UPDATE|SELECT/i)) {
    console.log('[' + q.file + '] ' + q.query.substring(0, 80).replace(/\n/g, ' '));
  }
});
