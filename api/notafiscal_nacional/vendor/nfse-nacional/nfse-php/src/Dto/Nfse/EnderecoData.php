<?php

namespace Nfse\Dto\Nfse;

use Spatie\DataTransferObject\Attributes\MapFrom;
use Spatie\DataTransferObject\DataTransferObject;

class EnderecoData extends DataTransferObject
{
    /**
     * Código do município (IBGE).
     */
    #[MapFrom('endNac.cMun')]
    public ?string $codigoMunicipio = null;

    /**
     * CEP.
     */
    #[MapFrom('endNac.CEP')]
    public ?string $cep = null;

    /**
     * Logradouro.
     */
    #[MapFrom('xLgr')]
    public ?string $logradouro = null;

    /**
     * Número.
     */
    #[MapFrom('nro')]
    public ?string $numero = null;

    /**
     * Bairro.
     */
    #[MapFrom('xBairro')]
    public ?string $bairro = null;

    /**
     * Complemento.
     */
    #[MapFrom('xCpl')]
    public ?string $complemento = null;

    /**
     * Endereço no exterior.
     */
    #[MapFrom('endExt')]
    public ?EnderecoExteriorData $enderecoExterior = null;
}
