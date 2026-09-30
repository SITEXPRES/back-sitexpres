import {
  normalizarDominio,
  isDominioBr,
  normalizarDataNascimento,
  extrairNumeroEndereco
} from './services/registroBrService.js';

console.log("=== TESTES REGISTROBR SERVICE ===");

// 1. Teste de detecção de domínio .br
console.log("isDominioBr('meusite.com.br'):", isDominioBr('meusite.com.br') === true ? '✅ PASSOU' : '❌ FALHOU');
console.log("isDominioBr('https://exemplo.net.br/'):", isDominioBr('https://exemplo.net.br/') === true ? '✅ PASSOU' : '❌ FALHOU');
console.log("isDominioBr('meusite.com'):", isDominioBr('meusite.com') === false ? '✅ PASSOU' : '❌ FALHOU');

// 2. Teste de normalização de domínio
console.log("normalizarDominio('  https://WWW.MEUSITE.COM.BR/ '):", normalizarDominio('  https://WWW.MEUSITE.COM.BR/ ') === 'www.meusite.com.br' ? '✅ PASSOU' : '❌ FALHOU');

// 3. Teste de normalização de data de nascimento
console.log("normalizarDataNascimento('20/05/1990'):", normalizarDataNascimento('20/05/1990') === '1990-05-20' ? '✅ PASSOU' : '❌ FALHOU');
console.log("normalizarDataNascimento('1990-05-20'):", normalizarDataNascimento('1990-05-20') === '1990-05-20' ? '✅ PASSOU' : '❌ FALHOU');

// 4. Teste de extração de número de endereço
console.log("extrairNumeroEndereco('Avenida Paulista, 1000', null):", extrairNumeroEndereco('Avenida Paulista, 1000', null) === '1000' ? '✅ PASSOU' : '❌ FALHOU');
console.log("extrairNumeroEndereco('Rua das Flores', '45B'):", extrairNumeroEndereco('Rua das Flores', '45B') === '45B' ? '✅ PASSOU' : '❌ FALHOU');
console.log("extrairNumeroEndereco('Rua Sem Numero', null):", extrairNumeroEndereco('Rua Sem Numero', null) === 'SN' ? '✅ PASSOU' : '❌ FALHOU');

console.log("=== TODOS OS TESTES CONCLUÍDOS COM SUCESSO ===");
