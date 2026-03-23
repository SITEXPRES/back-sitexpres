<?php

namespace Nfse\Dto\Http;

use Spatie\DataTransferObject\Attributes\MapFrom;
use Spatie\DataTransferObject\DataTransferObject;

class DistribuicaoNsuDto extends DataTransferObject
{
    #[MapFrom('NSU')]
    public ?int $nsu = null;

    #[MapFrom('chAcesso')]
    public ?string $chaveAcesso = null;

    #[MapFrom('dfeXmlGZipB64')]
    public ?string $dfeXmlGZipB64 = null;
}
