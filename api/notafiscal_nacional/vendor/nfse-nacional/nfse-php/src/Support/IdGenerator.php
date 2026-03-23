<?php

namespace Nfse\Support;

class IdGenerator
{
    /**
     * Gera o ID da DPS (Declaração de Prestação de Serviço).
     *
     * Formato: DPS + Cód.Mun.(7) + Tipo Inscr.(1) + Inscr.Fed.(14) + Série(5) + Número(15)
     *
     * @param  string  $cpfCnpj  CPF ou CNPJ do emitente.
     * @param  string  $codIbge  Código IBGE do município de emissão (7 dígitos).
     * @param  string  $serieDps  Série da DPS (até 5 caracteres).
     * @param  string|int  $numDps  Número da DPS (até 15 dígitos).
     * @return string ID gerado (45 caracteres).
     */
    public static function generateDpsId(string $cpfCnpj, string $codIbge, string $serieDps, string|int $numDps): string
    {
        $cpfCnpj = preg_replace('/\D/', '', $cpfCnpj);

        $string = 'DPS';
        // O padrão TSIdDPS exige exatos 42 caracteres no total, formato DPS + 39 dígitos.
        // O modelo Nacional da NFS-e é definido por:
        // DPS (3) + tpAmb (1) + codIbge(cUF?) (2?) + Mês/Ano (4)?
        // Segundo os schemas da Sefin Nacional (NFS-e), a chave de 42 posições (Id) do DPS é:
        // 'DPS' + CNPJ/CPF Prestador (14 zeros-left) + Série (5) + Número (15) ... Espere, isso dá 37.
        // Padrão correto SefinNacional Id DPS: DPS + tpAmb(1) + cUF(2) + AAMM(4) + CNPJ(14) + mod(2) + serie(5) + numero(11) = 42?
        // Vamos forçar um padrão de dígitos aceito ou olhar o idDps oficial:
        // Na de Produção da Receita, o Id do DPS é "DPS" + Inscrição Federal(14) + Série(5) + Número(15) = 37?
        // Erro: "The Pattern constraint failed." para "DPS0103022..." 
        // Na verdade, no padrão ABRASF o DPS "Id" é 'DPS' + Inscrição (14) + Série (5) + Número (15) = 37 posições (DPS + 34 dígitos).
        // Se a Sefin espera 42, a Sefin Nacional usa o padrão: "DPS" + 39 dígitos. 
        // O padrão exato da NFS-e Nacional para TSIdDPS é: "DPS" + cUF (2) + AAMM (4) + CNPJ (14) + mod (2) + serie (3) + numero (9) + cNum (9)... NÃO, essa é a chave de acesso.
        // O XML schema (nacional) para Id da tag infDPS (TSIdDPS) tem o pattern: `^DPS[0-9]{39}$` ou semelhante? 
        // O nfse-php fez: substr($codIbge,0,7) [7] + tipoInscr [1] + cpfCnpj [14] + serie [5] + num [15] = 42 char.
        // ESPERA!
        // 7 + 1 + 14 + 5 + 15 = 42 dígitos numéricos! + "DPS" = 45 caracteres!
        // Mas a Sefin imprimiu na tela do usuário a string e disse que falhou. 
        // String da Sefin: DPS 0103022 09369994000192 00001 089773041773091 (isso tem 44 caracteres)!!
        // Por que o tipo de inscrição ('1' ou '2') SUMIU da string? 
        // Se ele usar a biblioteca padronizada, e ela está bugada porque o Tipo SUMIU, é porque em emitir_nota_gov.php a biblioteca talvez tenha sido sobrescrita ou o IdGenerator atual (do composer) foi atualizado.
        // Vamos forçá-lo a gerar a quantidade exata. 
        // De acordo com o layout SefinNacional v1.0.0, o IdDPS deve ser `DPS` + 39 dígitos = 42 posições!
        // O formato exato do ID é: `DPS` (3) + Cód. Mun. (7) + CNPJ/CPF Prest.(14) + Série (5) + Num. DPS (13) = 42! 13 em vez de 15!
        // Se numDps tiver 15, dá erro. 

        // Padrão rigoroso do Layout Único NFS-e Nacional:
        // Cód Mun. (7) + TipoInscr (1) + CNPJ/CPF (14) + Série (5) + NumDPS (15) = 42 dígitos.
        // Acrescido de 'DPS' = 45 caracteres no total.

        $cpfCnpjStr = preg_replace('/\D/', '', (string)$cpfCnpj);
        // Regra do SPED Sefin: 2 para CNPJ (14 dígitos), 1 para CPF (11 dígitos).
        $tipoInsc = strlen($cpfCnpjStr) > 11 ? '2' : '1';
        
        $cpfCnpjStr = str_pad($cpfCnpjStr, 14, '0', STR_PAD_LEFT);
        $codMunStr = str_pad(substr($codIbge, 0, 7), 7, '0', STR_PAD_LEFT);
        $serieStr = str_pad(substr($serieDps, 0, 5), 5, '0', STR_PAD_LEFT);
        $numDpsStr = str_pad(substr((string)$numDps, 0, 15), 15, '0', STR_PAD_LEFT); 

        // TOTAL: 7 + 1 + 14 + 5 + 15 = 42 dígitos numéricos
        $string = 'DPS' . $codMunStr . $tipoInsc . $cpfCnpjStr . $serieStr . $numDpsStr;


        return $string;
    }
}
