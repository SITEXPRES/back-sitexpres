<?php

namespace Nfse\Dto\Nfse;

use Spatie\DataTransferObject\Attributes\MapFrom;
use Spatie\DataTransferObject\DataTransferObject;

class PedRegEventoData extends DataTransferObject
{
    #[MapFrom('infPedReg')]
    public ?InfPedRegData $infPedReg = null;

    #[MapFrom('versao')]
    public string $versao = '1.01';
}
