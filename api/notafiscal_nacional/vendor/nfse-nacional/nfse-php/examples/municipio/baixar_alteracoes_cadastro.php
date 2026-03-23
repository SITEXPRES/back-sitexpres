<?php

/** @var \Nfse\Nfse $nfse */
$nfse = require_once __DIR__.'/../bootstrap.php';

try {
    $nsu = 1;

    echo "Baixando alterações cadastrais (NSU: $nsu)...\n";

    $alteracoes = $nfse->municipio()->baixarAlteracoesCadastro($nsu);

    print_r($alteracoes);
} catch (\Exception $e) {
    echo 'Erro: '.$e->getMessage()."\n";
}
