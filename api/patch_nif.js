import fs from 'fs';

let code = fs.readFileSync('notafiscal_nacional/emitir_nota_gov.php', 'utf8');

// Remover a linha do cNaoNIF (qualquer uma que existir) e colocar o NIF
code = code.replace(/'cNaoNIF'\s*=>\s*'1'\s*,/g, "'NIF' => '000000000',");
code = code.replace(/"cNaoNIF"\s*=>\s*"1"\s*,/g, "'NIF' => '000000000',");
code = code.replace(/'cNaoNIF'\s*=>\s*1\s*,/g, "'NIF' => '000000000',");
code = code.replace(/"cNaoNIF"\s*=>\s*1\s*,/g, "'NIF' => '000000000',");
code = code.replace(/'cNaoNIF'\s*=>\s*0\s*,/g, "'NIF' => '000000000',");
code = code.replace(/"cNaoNIF"\s*=>\s*0\s*,/g, "'NIF' => '000000000',");

fs.writeFileSync('notafiscal_nacional/emitir_nota_gov.php', code);
console.log("Patched to use NIF instead of cNaoNIF");
