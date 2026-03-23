<?php

namespace Nfse\Dto\Http;

use Spatie\DataTransferObject\DataTransferObject;

class ConsultaDpsResponse extends DataTransferObject
{
    public ?int $tipoAmbiente = null;

    public ?string $versaoAplicativo = null;

    public ?string $dataHoraProcessamento = null;

    public ?string $idDps = null;

    public ?string $chaveAcesso = null;
}
