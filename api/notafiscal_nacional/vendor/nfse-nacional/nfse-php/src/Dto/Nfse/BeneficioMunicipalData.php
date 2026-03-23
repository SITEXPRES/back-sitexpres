<?php

namespace Nfse\Dto\Nfse;

use Spatie\DataTransferObject\Attributes\MapFrom;
use Spatie\DataTransferObject\DataTransferObject;

class BeneficioMunicipalData extends DataTransferObject
{
    /**
     * Código de identificação do Benefício Municipal.
     */
    #[MapFrom('nBM')]
    public ?string $codigoBeneficio = null;

    /**
     * Percentual de redução da base de cálculo referente ao benefício municipal.
     */
    #[MapFrom('pRedBCBM')]
    public ?float $percentualReducaoBcBm = null;

    /**
     * Valor monetário de redução da base de cálculo referente ao benefício municipal.
     */
    #[MapFrom('vRedBCBM')]
    public ?float $valorReducaoBcBm = null;
}
