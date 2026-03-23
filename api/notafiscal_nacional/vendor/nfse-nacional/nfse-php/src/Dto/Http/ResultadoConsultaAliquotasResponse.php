<?php

namespace Nfse\Dto\Http;

use Spatie\DataTransferObject\DataTransferObject;

class ResultadoConsultaAliquotasResponse extends DataTransferObject
{
    public ?string $mensagem = null;

    /**
     * @var AliquotaDto[]
     */
    public array $aliquotas = [];
}
