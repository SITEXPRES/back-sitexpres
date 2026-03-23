<?php

require __DIR__ . '/vendor/autoload.php'; // composer autoload

use Nfse\Http\NfseContext;
use Nfse\Nfse;
use Nfse\Enums\TipoAmbiente;

// Configurar o contexto da NFSe
$context = new NfseContext(
    ambiente: TipoAmbiente::Producao,               // ← PRODUÇÃO
    certificatePath: __DIR__ . '/certificado.pfx',  // caminho para seu certificado PFX
    certificatePassword: 'Cris1234'         // ALTERE se necessário
);

// Instanciar a NFSe
$nfse = new Nfse($context);

try {
    $chave = '15061382209369994000192000000000000126018430254761'; // substitua pela chave da sua nota

    echo "Consultando DANFSe para a chave: $chave...\n";

    // Faz o download do PDF do DANFSe
    $pdfContent = $nfse->contribuinte()->downloadDanfse($chave);

    if (!$pdfContent) {
        throw new \Exception("Não foi possível gerar o PDF para a chave informada.");
    }

    // Salvar PDF no diretório atual
    $filename = __DIR__ . "/danfse_$chave.pdf";
    file_put_contents($filename, $pdfContent);

    echo "✅ DANFSe salvo com sucesso em: $filename\n";

    // Opcional: consultar XML
    $xmlContent = $nfse->contribuinte()->consultar($chave);
    $xmlFile = __DIR__ . "/nfse_$chave.xml";
    file_put_contents($xmlFile, $xmlContent);
    echo "✅ XML da NFS-e salvo em: $xmlFile\n";

} catch (\Exception $e) {
    echo "❌ Erro: " . $e->getMessage() . "\n";
}
