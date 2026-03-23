<?php

namespace Nfse\Dto\Http;

use Spatie\DataTransferObject\DataTransferObject;

class ResultadoConsultaConfiguracoesConvenioResponse extends DataTransferObject
{
    public ?string $mensagem = null;

    public ?ParametrosConfiguracaoConvenioDto $parametrosConvenio = null;
}
