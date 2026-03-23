import 'dotenv/config'; // Garante que o .env será carregado
import { gerarNotaNacional } from './services/notafiscalService.js';

async function testarEmissao() {
  console.log("Iniciando teste de emissão de NFS-e Nacional...");
  console.log("Variável NFSE_AMBIENTE do .env:", process.env.NFSE_AMBIENTE || "Não definida (Usando Padrão)");

  // Dados fictícios para testar a integração do Node com o PHP
  const dadosParaNota = {
    valor_servico: 50.00,
    cnpj_cpf: "12345678909", // CPF válido fake ou CNPJ
    razao_social: "Cliente de Teste da Silva",
    endereco: "Rua do Teste",
    bairro: "Bairro do Teste",
    cod_municipio: "1506138", // Redenção
    uf: "PA",
    cep: "68553-170",
    telefone: "11999999999",
    email: "cliente.teste@exemplo.com",
    descricao: "Teste de emissão vinda do script creatnota.js"
  };

  try {
    const resultado = await gerarNotaNacional(dadosParaNota);

    console.log("\n================ RESULTADO DA EMISSÃO =================>");
    
    if (resultado.sucesso) {
      console.log("✅ NFS-e Emitida com SUCESSO!");
      console.log("Chave de Acesso:", resultado.chaveAcesso);
      console.log("Número da NFS-e:", resultado.numeroNfse);
      console.log("Link para Consulta:", resultado.linkConsulta);
      
      // Útil caso queira ver os dados limpos retornado pelo PHP
      // console.log("Dados Completos:", JSON.stringify(resultado.dadosCompletos, null, 2));

    } else {
      console.log("❌ Ocorreu um ERRO ou a prefeitura rejeitou a nota.");
      console.log("Mensagem Geral:", resultado.mensagem);
      console.log("Detalhes do Erro:");
      console.dir(resultado.erro, { depth: null });
      
      if (resultado.stderr) {
        console.log("Erros Críticos do PHP (Stderr):");
        console.log(resultado.stderr);
      }
    }
    
    console.log("<======================================================\n");
  } catch (erroGeral) {
    console.error("Erro drástico ao tentar chamar a API de notas:", erroGeral);
  }
}

// Executa o script de teste
testarEmissao();
