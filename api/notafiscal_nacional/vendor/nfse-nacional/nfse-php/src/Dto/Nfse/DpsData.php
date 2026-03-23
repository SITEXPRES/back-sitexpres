<?php

namespace Nfse\Dto\Nfse;

use Spatie\DataTransferObject\Attributes\MapFrom;
use Spatie\DataTransferObject\DataTransferObject;

class DpsData extends DataTransferObject
{
    #[MapFrom('@versao')]
    public ?string $versao = null;

    #[MapFrom('infDPS')]
    public ?InfDpsData $infDps = null;
}
