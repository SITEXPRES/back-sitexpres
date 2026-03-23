<?php
/**
 * Script CLI para chamadas do Node.js
 * Lê o JSON via STDIN e retorna JSON.
 */

require_once __DIR__ . '/emitir_nota_gov.php';
use Nfse\Enums\TipoAmbiente;

header('Content-Type: application/json');

try {
    // 1. Lendo os dados de entrada
    $inputJSON = file_get_contents('php://stdin');
    $inputData = json_decode($inputJSON, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Erro ao decodificar JSON de entrada: " . json_last_error_msg());
    }

    // O prestador agora vem do input, que o Node leu do .env
    $prestador = $inputData['prestador'] ?? [];
    $cliente = $inputData['cliente'] ?? [];
    $servico = $inputData['servico'] ?? [];
    $ambienteStr = $inputData['ambiente'] ?? 'Producao';

    $ambiente = ($ambienteStr === 'Homologacao') ? TipoAmbiente::Homologacao : TipoAmbiente::Producao;

    // Construtor
    $emissor = new EmissorNfse(
        $prestador['codigoMunicipio'],
        $prestador['cnpjPrestador'],
        $prestador['inscricaoMunicipal'],
        [
            'nomeFantasia' => $prestador['nomeFantasia'] ?? '',
            'telefone' => $prestador['telefone'] ?? '',
            'email' => $prestador['email'] ?? '',
            'optanteSimplesNacional' => $prestador['optanteSimplesNacional'] ?? 3
        ],
        $prestador['certificadoPath'] ?? (__DIR__ . '/certificado.pfx'),
        $prestador['certificadoSenha'] ?? '',
        $ambiente
    );

    // Emitir
    $retorno = $emissor->emitir(
        $cliente,
        $servico,
        $servico['serie'] ?? '001',
        $servico['numero'] ?? null
    );

    // Garantir formato JSON correto de retorno (apenas ele na saída padrão)
    echo json_encode($retorno, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit(0);

} catch (Exception $e) {
    echo json_encode([
        'sucesso' => false,
        'erro' => [
            'mensagem' => $e->getMessage()
        ]
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit(1);
}
