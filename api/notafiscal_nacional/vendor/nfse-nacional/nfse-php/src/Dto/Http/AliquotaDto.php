<?php

namespace Nfse\Dto\Http;

use Spatie\DataTransferObject\Attributes\MapFrom;
use Spatie\DataTransferObject\DataTransferObject;

class AliquotaDto extends DataTransferObject
{
    #[MapFrom('incid')]
    public ?string $incidencia = null;

    #[MapFrom('aliq')]
    public ?float $aliquota = null;

    #[MapFrom('tpRet')]
    public ?int $tipoRetencao = null;
}
