<?php

namespace Nfse\Enums;

/**
 * Regime de apuração dos tributos (SN)
 *
 * Baseado no schema: TSRegApTribSN
 */
enum RegimeApuracaoSN: string
{
    /**
     * Regime de apuração dos tributos federais e municipal pelo SN
     */
    case SimplesNacional = '1';

    /**
     * Regime de apuração dos tributos federais pelo SN e municipal pelo regime normal (ISSQN)
     */
    case Normal = '2';

    /**
     * Get description for the enum case
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::SimplesNacional => 'Regime de apuração dos tributos federais e municipal pelo SN',
            self::Normal => 'Regime de apuração dos tributos federais pelo SN e municipal pelo regime normal (ISSQN)',
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
