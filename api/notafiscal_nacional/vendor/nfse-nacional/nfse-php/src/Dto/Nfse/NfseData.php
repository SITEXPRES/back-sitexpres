<?php

namespace Nfse\Dto\Nfse;

use Spatie\DataTransferObject\Attributes\MapFrom;
use Spatie\DataTransferObject\DataTransferObject;

class NfseData extends DataTransferObject
{
    /**
     * Versão do leiaute.
     */
    #[MapFrom('versao')]
    public ?string $versao = null;

    /**
     * Informações da NFS-e.
     */
    #[MapFrom('infNFSe')]
    public ?InfNfseData $infNfse = null;
}
