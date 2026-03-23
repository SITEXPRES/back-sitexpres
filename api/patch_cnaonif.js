import fs from 'fs';
let code = fs.readFileSync('notafiscal_nacional/emitir_nota_gov.php', 'utf8');

code = code.replace("'cNaoNIF' => 0,", "'cNaoNIF' => 1,");
code = code.replace('"cNaoNIF" => 0,', '"cNaoNIF" => 1,');

fs.writeFileSync('notafiscal_nacional/emitir_nota_gov.php', code);
console.log("Patched cNaoNIF to 1");
