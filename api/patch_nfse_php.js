import fs from 'fs';

let phpCode = fs.readFileSync('notafiscal_nacional/emitir_nota_gov.php', 'utf8');

// 1. Update tribISSQN
const oldTrib = `            // 🔧 AJUSTE: tribISSQN é SEMPRE 1
            $tribISSQN = 1;`;
            
const newTrib = `            // 🔧 AJUSTE: tribISSQN
            $isForeign = $dadosTomador['isForeign'] ?? false;
            $tribISSQN = $isForeign ? 3 : 1;`;

phpCode = phpCode.replace(oldTrib, newTrib);

// 2. Update tribMun with cPaisResult
const oldTribMun = `            // Dados de tributação municipal
            $tribMun = [
                'tribISSQN' => $tribISSQN,           // 1
                'tpRetISSQN' => $tpRetISSQN,         // 2 (retido)

            ];`;
            
const newTribMun = `            // Dados de tributação municipal
            $tribMun = [
                'tribISSQN' => $tribISSQN,           // 1 ou 3
                'tpRetISSQN' => $tpRetISSQN,         // 1 ou 2
            ];
            
            if ($isForeign) {
                $tribMun['cPaisResult'] = $dadosTomador['pais'] ?? 'US';
            }`;

phpCode = phpCode.replace(oldTribMun, newTribMun);

// 3. Update montarTomador
const oldMontarTomador = `    private function montarTomador(array $dadosTomador): array
    {
        $tipo = strtoupper($dadosTomador['tipo']);

        $nome = $tipo === 'CPF'
            ? ($dadosTomador['nome'] ?? $dadosTomador['Nome'] ?? '')
            : ($dadosTomador['razaoSocial'] ?? $dadosTomador['nome'] ?? '');

        return [
            $tipo => $dadosTomador['cpfCnpj'],
            'xNome' => $nome,
            'email' => $dadosTomador['email'] ?? '',
        ];
    }`;

const newMontarTomador = `    private function montarTomador(array $dadosTomador): array
    {
        $tipo = strtoupper($dadosTomador['tipo']);
        $isForeign = $dadosTomador['isForeign'] ?? false;

        $nome = $tipo === 'CPF'
            ? ($dadosTomador['nome'] ?? $dadosTomador['Nome'] ?? '')
            : ($dadosTomador['razaoSocial'] ?? $dadosTomador['nome'] ?? 'Consumidor Estrangeiro');

        if ($isForeign) {
            return [
                'cNaoNIF' => 0, // 0 - Nao informado
                'xNome' => $nome,
                'email' => $dadosTomador['email'] ?? '',
                'end' => [
                    'endExt' => [
                        'cPais' => $dadosTomador['pais'] ?? 'US',
                        'xCidade' => $dadosTomador['cidade'] ?? 'Exterior',
                        'xEstProvReg' => 'EX'
                    ]
                ]
            ];
        }

        return [
            $tipo => $dadosTomador['cpfCnpj'],
            'xNome' => $nome,
            'email' => $dadosTomador['email'] ?? '',
        ];
    }`;

phpCode = phpCode.replace(oldMontarTomador, newMontarTomador);

// 4. Update Servico with comExt and cNBS
const oldServ = `'serv' => [
                        'cServ' => [
                            'cTribNac' => $dadosServico['codigoTributacao'],
                            'xDescServ' => $dadosServico['descricao'],
                        ],`;

const newServ = `'serv' => [
                        'cServ' => [
                            'cTribNac' => $dadosServico['codigoTributacao'],
                            'xDescServ' => $dadosServico['descricao'],
                            'cNBS' => $isForeign ? '101010100' : null,
                        ],
                        'comExt' => $isForeign ? [
                            'mdPrestacao' => 1, // Transfronteiriço
                            'vincPrest' => 1, // Sem vínculo
                            'tpMoeda' => 'USD',
                            'vServMoeda' => $dadosServico['valorServico']
                        ] : null,`;

phpCode = phpCode.replace(oldServ, newServ);

fs.writeFileSync('notafiscal_nacional/emitir_nota_gov.php', phpCode);
console.log('emitir_nota_gov.php update completed applying foreign payload mapping.');
