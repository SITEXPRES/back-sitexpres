<?php

namespace Nfse\Enums;

/**
 * Tipo de Retenção do PIS/COFINS
 */
enum TipoRetencaoPisCofins: int
{
    /**
     * Não Retido
     */
    case NaoRetido = 1;

    /**
     * Retido
     */
    case Retido = 2;

    public function getDescription(): string
    {
        return match ($this) {
            self::NaoRetido => 'Não Retido',
            self::Retido => 'Retido',
        };
    }

    public function label(): string
    {
        return $this->getDescription();
    }
}
