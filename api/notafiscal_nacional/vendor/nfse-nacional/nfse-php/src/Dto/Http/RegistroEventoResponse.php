<?php

namespace Nfse\Dto\Http;

use Spatie\DataTransferObject\DataTransferObject;

class RegistroEventoResponse extends DataTransferObject
{
    public ?int $tipoAmbiente = null;

    public ?string $versaoAplicativo = null;

    public ?string $dataHoraProcessamento = null;

    public ?string $eventoXmlGZipB64 = null;
}
