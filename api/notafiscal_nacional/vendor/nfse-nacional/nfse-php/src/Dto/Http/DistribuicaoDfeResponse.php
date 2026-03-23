<?php

namespace Nfse\Dto\Http;

use Spatie\DataTransferObject\Attributes\MapFrom;
use Spatie\DataTransferObject\DataTransferObject;

class DistribuicaoDfeResponse extends DataTransferObject
{
    #[MapFrom('tpAmb')]
    public ?string $tipoAmbiente = null;

    #[MapFrom('verAplic')]
    public ?string $versaoAplicativo = null;

    #[MapFrom('dhProc')]
    public ?string $dataHoraProcessamento = null;

    #[MapFrom('ultNSU')]
    public ?int $ultimoNsu = null;

    #[MapFrom('maiorNSU')]
    public ?int $maiorNsu = null;

    public array $alertas = [];

    public array $erros = [];

    #[MapFrom('lNSU')]
    public array $listaNsu = [];
}
