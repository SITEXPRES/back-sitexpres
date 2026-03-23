<?php

/** @var \Nfse\Nfse $nfse */
$nfse = require_once __DIR__.'/../bootstrap.php';

try {
    $chave = '35503080000000000000000000000000000000000000'; // Substitua pela chave real

    echo "Consultando NFS-e: $chave...\n";

    $nfseData = $nfse->contribuinte()->consultar($chave);

    if ($nfseData) {
        echo "NFS-e encontrada!\n";
        // print_r($nfseData);
    } else {
        echo "NFS-e não encontrada.\n";
    }
} catch (\Exception $e) {
    echo 'Erro: '.$e->getMessage()."\n";
}
