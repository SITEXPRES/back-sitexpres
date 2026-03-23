<?php

namespace Nfse\Dto\Nfse;

use Spatie\DataTransferObject\Attributes\MapFrom;
use Spatie\DataTransferObject\DataTransferObject;

class ObraData extends DataTransferObject
{
    /**
     * Inscrição imobiliária fiscal da obra.
     */
    #[MapFrom('inscImobFisc')]
    public ?string $inscricaoImobiliariaFiscal = null;

    /**
     * Código da obra.
     */
    #[MapFrom('cObra')]
    public ?string $codigoObra = null;

    /**
     * Endereço da obra.
     */
    #[MapFrom('end')]
    public ?EnderecoData $endereco = null;
}
