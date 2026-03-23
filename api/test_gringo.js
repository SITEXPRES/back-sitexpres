import { gerarNotaNacional } from './services/notafiscalService.js';
import 'dotenv/config';

console.log("Iniciando teste de emissão NFS-e Nacional para GRINGO...");

// Simulando EXATAMENTE os dados de teste que enviou para o Pix
const payload = {
  valor_servico: 0.85,
  cnpj_cpf: "12158115481215  ", // O banco recusa, mas pra nota fiscal vai identificar como isForeign
  razao_social: "cliente gringo teste",
  endereco: "New York, United States",
  bairro: "Exterior",
  cod_municipio: "",
  uf: "EX",
  cep: "00000000",
  telefone: "0000000000",
  email: "josue123201856@gmail.com",
  descricao: "Compra via pix Sitexpress IA e WebHosting (Exportacao)"
};

async function run() {
    console.log("Variável NFSE_AMBIENTE:", process.env.NFSE_AMBIENTE);
    console.log("Variável NFSE_CODIGO_MUNICIPIO:", process.env.NFSE_CODIGO_MUNICIPIO);
    
    const resultado = await gerarNotaNacional(payload);
    
    console.log("\n================ RESULTADO GRINGO =================>");
    if (resultado.sucesso) {
        console.log("✅ NFS-e de EXPORTAÇÃO Emitida com SUCESSO!");
        console.log("Chave de Acesso:", resultado.chaveAcesso);
        console.log("Número da NFS-e:", resultado.numeroNfse);
        console.log("Link para Consulta:", resultado.linkConsulta);
    } else {
        console.log("❌ Ocorreu um ERRO ou a prefeitura rejeitou a nota estrangeira.");
        console.log("Mensagem Geral:", resultado.mensagem);
        console.log("Detalhes do Erro:\n", resultado.erro);
        if (resultado.stderr) {
            console.log("Erros Críticos do PHP (Stderr):\n", resultado.stderr);
        }
    }
    console.log("<======================================================\n");
}

run();
