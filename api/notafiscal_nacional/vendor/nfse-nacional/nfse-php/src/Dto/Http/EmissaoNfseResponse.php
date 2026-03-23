<?php

namespace Nfse\Dto\Http;

use Spatie\DataTransferObject\DataTransferObject;

class EmissaoNfseResponse extends DataTransferObject
{
    public ?int $tipoAmbiente = null;

    public ?string $versaoAplicativo = null;

    public ?string $dataHoraProcessamento = null;

    public ?string $idDps = null;

    public ?string $chaveAcesso = null;

    public ?string $nfseXmlGZipB64 = null;

    public array $alertas = [];

    public array $erros = [];
}
