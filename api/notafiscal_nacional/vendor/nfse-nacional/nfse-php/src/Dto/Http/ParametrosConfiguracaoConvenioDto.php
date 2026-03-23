<?php

namespace Nfse\Dto\Http;

use Spatie\DataTransferObject\Attributes\MapFrom;
use Spatie\DataTransferObject\DataTransferObject;

class ParametrosConfiguracaoConvenioDto extends DataTransferObject
{
    #[MapFrom('tpConv')]
    public ?int $tipoConvenio = null;

    #[MapFrom('tpInsc')]
    public ?int $tipoInscricao = null;

    #[MapFrom('nInsc')]
    public ?string $numeroInscricao = null;

    #[MapFrom('vinc')]
    public ?int $vinculo = null;
}
