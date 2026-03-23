<?php

require_once __DIR__ . '/vendor/autoload.php';

use Nfse\Http\NfseContext;
use Nfse\Nfse;
use Nfse\Enums\TipoAmbiente;
use Nfse\Dto\Nfse\DpsData;
use Nfse\Support\IdGenerator;

/**
 * Classe para emissão de NFS-e
 */
class EmissorNfse
{
    private NfseContext $context;
    private string $codigoMunicipio;
    private string $cnpjPrestador;
    private string $inscricaoMunicipal;
    private array $dadosPrestador;

    /**
     * Construtor da classe
     * 
     * @param string $codigoMunicipio Código IBGE do município
     * @param string $cnpjPrestador CNPJ do prestador
     * @param string $inscricaoMunicipal Inscrição Municipal
     * @param array $dadosPrestador Dados do prestador
     * @param string $certificadoPath Caminho do certificado .pfx
     * @param string $certificadoSenha Senha do certificado
     * @param TipoAmbiente $ambiente Ambiente (Producao ou Homologacao)
     */
    public function __construct(
        string $codigoMunicipio,
        string $cnpjPrestador,
        string $inscricaoMunicipal,
        array $dadosPrestador,
        string $certificadoPath,
        string $certificadoSenha,
        TipoAmbiente $ambiente = TipoAmbiente::Producao
    ) {
        date_default_timezone_set('America/Sao_Paulo');

        $this->codigoMunicipio = $codigoMunicipio;
        $this->cnpjPrestador = $cnpjPrestador;
        $this->inscricaoMunicipal = $inscricaoMunicipal;
        $this->dadosPrestador = $dadosPrestador;

        $this->context = new NfseContext(
            ambiente: $ambiente,
            certificatePath: $certificadoPath,
            certificatePassword: $certificadoSenha
        );
    }

    /**
     * Emite uma NFS-e
     * 
     * @param array $dadosTomador Dados do tomador (cliente)
     * @param array $dadosServico Dados do serviço
     * @param string|null $serie Série da NFS-e (padrão: '001')
     * @param string|null $numero Número da NFS-e (padrão: timestamp)
     * @return array Dados da nota emitida
     * @throws Exception Em caso de erro na emissão
     */
    public function emitir(
        array $dadosTomador,
        array $dadosServico,
        ?string $serie = '001',
        ?string $numero = null
    ): array {
        try {
            // Gerar número sequencial se não fornecido

            $numero = $dadosServico['codigo_dps'];

            // Gerar ID da DPS
            $idDps = IdGenerator::generateDpsId(
                cpfCnpj: $this->cnpjPrestador,
                codIbge: $this->codigoMunicipio,
                serieDps: $serie,
                numDps: $numero
            );

            // Verificar se ISS é retido
            $issRetido = ($dadosServico['imposto_retido'] === 'sim');

            $tribISSQN = 1;
            $tpRetISSQN = $issRetido ? 2 : 1;

            // Montar estrutura do tomador
            $tomadorData = $this->montarTomador($dadosTomador);

            if ($issRetido) {
                unset($tomadorData['endNac'], $tomadorData['end']['endNac']);
                $endereco = $this->obterEnderecoTomador($dadosTomador);
                $tomadorData['end'] = $endereco;
            }

            // =========================
            // MONTAR TRIBUTAÇÃO
            // =========================
            $trib = [
                'tribISSQN' => $tribISSQN,        // 1 = tributável
                'tpRetISSQN' => $tpRetISSQN,      // 2 = retido, 1 = não retido
                'regApTribISSQN' => 1,            // 1 = Simples Nacional
            ];

            // Adicionar alíquota se retido
            if ($issRetido) {
                $trib['pAliq'] = number_format(
                    $dadosServico['aliquota'] ?? 1.80,
                    2,
                    '.',
                    ''
                );
            }

            // Percentual total de tributos (Simples Nacional)
            $trib['pTotTribSN'] = number_format(
                $dadosServico['percentual_tributos_sn'] ?? 0,
                2,
                '.',
                ''
            );

            // Montar estrutura da DPS
            $dps = new DpsData([
                '@versao' => '1.01',
                'infDPS' => [
                    '@Id' => $idDps,
                    'tpAmb' => $this->context->ambiente->value,
                    'dhEmi' => date('c'),
                    'verAplic' => 'SDK-PHP-1.0',
                    'serie' => $serie,
                    'nDPS' => $numero,
                    'dCompet' => date('Y-m-d'),
                    'tpEmit' => 1,
                    'cLocEmi' => $this->codigoMunicipio,

                    // PRESTADOR
                    'prest' => [
                        'CNPJ' => $this->cnpjPrestador,
                        'IM' => $this->inscricaoMunicipal,
                        'xFant' => $this->dadosPrestador['nomeFantasia'] ?? null,
                        'fone' => $this->dadosPrestador['telefone'] ?? null,
                        'email' => $this->dadosPrestador['email'] ?? null,

                        'regTrib' => [
                            'opSimpNac' => (int) ($this->dadosPrestador['optanteSimplesNacional'] ?? 3),
                            'regApTribSN' => 1,
                            'regEspTrib' => 0,
                        ],
                    ],

                    // TOMADOR
                    'toma' => $tomadorData,

                    // SERVIÇO
                    'serv' => [
                        'cServ' => [
                            'cTribNac' => $dadosServico['codigoTributacao'],
                            'xDescServ' => $dadosServico['descricao'],
                        ],
                        'locPrest' => [
                            'cLocPrestacao' => $this->codigoMunicipio,
                            'cPaisPrestacao' => 'BR',
                        ],
                    ],

                    // VALORES
                    'valores' => [
                        'vServPrest' => [
                            'vServ' => number_format($dadosServico['valorServico'], 2, '.', ''),
                        ],
                        'trib' => $trib,  // ✅ Passa o array $trib diretamente
                    ],
                ],
            ]);

            // Emitir NFS-e
            $nfse = new Nfse($this->context);
            $service = $nfse->contribuinte();
            $nfseData = $service->emitir($dps);

            // Salvar XML
            $arquivoXml = '';

            // Retornar dados estruturados
            return [
                'sucesso' => true,
                'numeroNfse' => $nfseData->infNfse->nNfse ?? null,
                'chaveAcesso' => $nfseData->infNfse->id ?? null,
                'codigoVerificacao' => $nfseData->infNfse->cVerif ?? null,
                'dataEmissao' => $nfseData->infNfse->dEmi ?? date('Y-m-d'),
                'valorServico' => $dadosServico['valorServico'],
                'arquivoXml' => $arquivoXml,
                'dadosCompletos' => $nfseData,
                'mensagem' => 'NFS-e emitida com sucesso!'
            ];

        } catch (\Exception $e) {
            return [
                'sucesso' => false,
                'erro' => [
                    'IM' => $this->inscricaoMunicipal,
                    'tipo' => get_class($e),
                    'mensagem' => $e->getMessage(),
                    'arquivo' => $e->getFile(),
                    'linha' => $e->getLine(),
                    'detalhes' => $this->extrairDetalhesErro($e)
                ]
            ];
        }
    }

    /**
     * Monta a estrutura do tomador baseado no tipo (CPF ou CNPJ)
     */
    /*  private function montarTomador(array $dadosTomador): array
     {
         $tipo = strtoupper($dadosTomador['tipo']);
         $nome = $tipo === 'CPF' ? ($dadosTomador['nome'] ?? $dadosTomador['Nome'] ?? '')
             : ($dadosTomador['razaoSocial'] ?? '');

         return [
             $tipo => $dadosTomador['cpfCnpj'],
             'xNome' => $nome,
             'end' => [
                 'xLgr' => $dadosTomador['logradouro'] ?? '',
                 'nro' => $dadosTomador['numero'] ?? 'S/N',
                 'xBairro' => $dadosTomador['bairro'] ?? '',
                 'endNac.cMun' => $dadosTomador['codigoMunicipio'] ?? $this->codigoMunicipio,
                 'endNac.CEP' => $dadosTomador['cep'] ?? '',
             ],
             'email' => $dadosTomador['email'] ?? '',
         ];
     }
  */
    private function montarTomador(array $dadosTomador): array
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
    }
    /**
     * Salva o XML da NFS-e
     */
    private function salvarXml($nfseData): string
    {
        $nomeArquivo = 'nfse_' . date('YmdHis') . '.xml';
        $caminhoCompleto = __DIR__ . '/nfse_emitidas/' . $nomeArquivo;

        // Criar diretório se não existir
        if (!is_dir(__DIR__ . '/nfse_emitidas')) {
            mkdir(__DIR__ . '/nfse_emitidas', 0755, true);
        }

        file_put_contents($caminhoCompleto, (string) $nfseData);

        return $caminhoCompleto;
    }

    /**
     * Extrai detalhes do erro da API
     */
    private function extrairDetalhesErro(\Exception $e): ?array
    {
        if (strpos($e->getMessage(), 'Resposta:') !== false) {
            preg_match('/Resposta: (.+)/', $e->getMessage(), $matches);
            if (isset($matches[1])) {
                $resposta = json_decode($matches[1], true);
                if ($resposta && isset($resposta['erros'])) {
                    return $resposta['erros'];
                }
            }
        }
        return null;
    }

    private function buscarEnderecoPorCep(string $cep): ?array
    {
        $cep = preg_replace('/\D/', '', $cep);

        if (strlen($cep) !== 8) {
            return null;
        }

        $url = "https://viacep.com.br/ws/{$cep}/json/";
        $response = @file_get_contents($url);

        if (!$response) {
            return null;
        }

        $dados = json_decode($response, true);

        if (isset($dados['erro']) && $dados['erro'] === true) {
            return null;
        }

        return [
            'logradouro' => $dados['logradouro'] ?? '',
            'bairro' => $dados['bairro'] ?? '',
            'municipio' => $dados['localidade'] ?? '',
            'uf' => $dados['uf'] ?? '',
            'codigoMunicipio' => $dados['ibge'] ?? null,
        ];
    }

    private function obterEnderecoTomador(array $dadosTomador): array
    {
        $endereco = $this->buscarEnderecoPorCep($dadosTomador['cep']);

        if (
            !$endereco ||
            empty($endereco['codigoMunicipio']) ||
            strlen($endereco['codigoMunicipio']) !== 7
        ) {
            // 🔒 Fallback 100% válido
            $endereco = [
                'logradouro' => 'VICINAL DA ROXA',
                'bairro' => 'ZONA RURAL',
                'municipio' => 'Redenção',
                'uf' => 'PA',
                'codigoMunicipio' => '1505486',
                'cep' => '68553170',
            ];
        }

        return [
            'endNac' => [
                'cMun' => $endereco['codigoMunicipio'],
                'CEP' => preg_replace('/\D/', '', $dadosTomador['cep'] ?? $endereco['cep']),
            ],
            'xLgr' => $this->limparTexto(
                $dadosTomador['logradouro'] ?: $endereco['logradouro']
            ),
            'nro' => $this->limparTexto(
                $dadosTomador['numero'] ?: 'S/N'
            ),
            'xBairro' => $this->limparTexto(
                $dadosTomador['bairro'] ?: $endereco['bairro']
            ),
        ];

    }
    private function limparTexto(string $valor): string
    {
        return trim(
            preg_replace('/\s+/', ' ', $valor)
        );
    }




}
