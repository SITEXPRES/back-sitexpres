<?php

/** @var \Nfse\Nfse $nfse */
$nfse = require_once __DIR__.'/../bootstrap.php';

try {
    $nsu = 1;

    echo "Baixando DF-e para o municipio (NSU: $nsu)...\n";

    $response = $nfse->contribuinte()->baixarDfe($nsu);

    echo 'NSU Final: '.$response->ultimoNsu."\n";
    echo 'Quantidade de documentos: '.count($response->listaNsu)."\n";

    $filesDir = __DIR__.'/../files/';
    if (! is_dir($filesDir)) {
        mkdir($filesDir, 0777, true);
    }

    $chaves = [];

    foreach ($response->listaNsu as $nsu) {
        $xmlContent = gzdecode(base64_decode($nsu->dfeXmlGZipB64));

        if ($xmlContent === false) {
            echo "Erro ao descompactar GZIP para NSU {$nsu->nsu}\n";

            continue;
        }

        if ($nsu->chaveAcesso) {
            $chaves[] = $nsu->chaveAcesso;
        }

        $xmlPath = $filesDir.$nsu->nsu.'.xml';
        file_put_contents($xmlPath, $xmlContent);
        echo "Salvo: $xmlPath\n";
    }

    foreach ($chaves as $chave) {
        $danfse = $nfse->contribuinte()->downloadDanfse($chave);
        $danfsePath = $filesDir.$chave.'.pdf';
        file_put_contents($danfsePath, $danfse);
        echo "Salvo: $danfsePath\n";
    }
    // print_r($response);
} catch (\Exception $e) {
    echo 'Erro: '.$e->getMessage()."\n";
}
