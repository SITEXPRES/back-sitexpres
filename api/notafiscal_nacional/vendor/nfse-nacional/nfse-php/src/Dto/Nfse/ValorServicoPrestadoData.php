<?php

namespace Nfse\Dto\Nfse;

use Spatie\DataTransferObject\Attributes\MapFrom;
use Spatie\DataTransferObject\DataTransferObject;

class ValorServicoPrestadoData extends DataTransferObject
{
    /**
     * Valor recebido pelo intermediário.
     * Obrigatório se tpEmit = 3.
     */
    #[MapFrom('vReceb')]
    public ?float $valorRecebido = null;

    /**
     * Valor do serviço prestado.
     */
    #[MapFrom('vServ')]
    public ?float $valorServico = null;
}
