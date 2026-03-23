<?php

namespace Nfse\Enums;

/**
 * Motivo da substituição de NFS-e
 *
 * Baseado no schema: TSMotivoSubst
 */
enum MotivoSubstituicao: string
{
    /**
     * Desenquadramento de NFS-e do Simples Nacional
     */
    case DesenquadramentoSimplesNacional = '01';

    /**
     * Enquadramento de NFS-e no Simples Nacional
     */
    case EnquadramentoSimplesNacional = '02';

    /**
     * Outros
     */
    case Outros = '99';

    /**
     * Get description for the enum case
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::DesenquadramentoSimplesNacional => 'Desenquadramento de NFS-e do Simples Nacional',
            self::EnquadramentoSimplesNacional => 'Enquadramento de NFS-e no Simples Nacional',
            self::Outros => 'Outros',
        };
    }

    /**
     * Get label (alias for getDescription)
     */
    public function label(): string
    {
        return $this->getDescription();
    }
}
