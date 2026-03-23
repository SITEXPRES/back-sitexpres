<?php

namespace Nfse\Dto\Http;

use Spatie\DataTransferObject\DataTransferObject;

class MensagemProcessamentoDto extends DataTransferObject
{
    public ?string $mensagem = null;

    public ?array $parametros = null;

    public ?string $codigo = null;

    public ?string $descricao = null;

    public ?string $complemento = null;
}
