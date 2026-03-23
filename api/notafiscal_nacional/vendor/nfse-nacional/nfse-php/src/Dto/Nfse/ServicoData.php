<?php

namespace Nfse\Dto\Nfse;

use Spatie\DataTransferObject\Attributes\MapFrom;
use Spatie\DataTransferObject\DataTransferObject;

class ServicoData extends DataTransferObject
{
    /**
     * Local da prestação do serviço.
     */
    #[MapFrom('locPrest')]
    public ?LocalPrestacaoData $localPrestacao = null;

    /**
     * Código do serviço prestado.
     */
    #[MapFrom('cServ')]
    public ?CodigoServicoData $codigoServico = null;

    /**
     * Informações de comércio exterior.
     */
    #[MapFrom('comExt')]
    public ?ComercioExteriorData $comercioExterior = null;

    /**
     * Informações da obra.
     */
    #[MapFrom('obra')]
    public ?ObraData $obra = null;

    /**
     * Informações de atividade/evento.
     */
    #[MapFrom('atvEvento')]
    public ?AtividadeEventoData $atividadeEvento = null;

    /**
     * Informações complementares do serviço.
     */
    #[MapFrom('infoComplem')]
    public ?string $informacoesComplementares = null;

    /**
     * Identificador do documento técnico.
     */
    #[MapFrom('idDocTec')]
    public ?string $idDocumentoTecnico = null;

    /**
     * Documento de referência.
     * Obrigatório se tpEmit = 2 ou 3.
     */
    #[MapFrom('docRef')]
    public ?string $documentoReferencia = null;

    /**
     * Outras informações complementares.
     */
    #[MapFrom('xInfComp')]
    public ?string $descricaoInformacoesComplementares = null;
}
