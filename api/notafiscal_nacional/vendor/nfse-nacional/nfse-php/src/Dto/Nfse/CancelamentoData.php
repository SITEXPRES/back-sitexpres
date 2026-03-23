<?php

namespace Nfse\Dto\Nfse;

use Spatie\DataTransferObject\Attributes\MapFrom;
use Spatie\DataTransferObject\DataTransferObject;

class CancelamentoData extends DataTransferObject
{
    #[MapFrom('xDesc')]
    public ?string $descricao = null;

    #[MapFrom('cMotivo')]
    public ?string $codigoMotivo = null;

    #[MapFrom('xMotivo')]
    public ?string $motivo = null;
}
