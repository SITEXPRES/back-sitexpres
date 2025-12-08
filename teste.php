<?php

/* ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
 */
header('Content-Type: application/json; charset=utf-8');

$certificado_txt = 'MIIH2jCCBcKgAwIBAgIUJM3ouwDYwTvQUsQf+e4AxIfj5/gwDQYJKoZIhvcNAQEL
BQAwejELMAkGA1UEBhMCQlIxEzARBgNVBAoTCklDUC1CcmFzaWwxNjA0BgNVBAsT
LVNlY3JldGFyaWEgZGEgUmVjZWl0YSBGZWRlcmFsIGRvIEJyYXNpbCAtIFJGQjEe
MBwGA1UEAxMVQUMgRElHSVRBTFNJR04gUkZCIEczMB4XDTI1MTEwNjExMzY1OVoX
DTI2MTEwNjExMzY1OVowgf0xCzAJBgNVBAYTAkJSMRMwEQYDVQQKDApJQ1AtQnJh
c2lsMQswCQYDVQQIDAJQQTERMA8GA1UEBwwIUmVkZW5jYW8xNjA0BgNVBAsMLVNl
Y3JldGFyaWEgZGEgUmVjZWl0YSBGZWRlcmFsIGRvIEJyYXNpbCAtIFJGQjEWMBQG
A1UECwwNUkZCIGUtQ05QSiBBMTEXMBUGA1UECwwOMjE0MzgzNTAwMDAxMDQxGTAX
BgNVBAsMEHZpZGVvY29uZmVyZW5jaWExNTAzBgNVBAMMLENMT1VEWCBTRVJWSUNP
UyBFTSBOVVZFTSBMVERBOjA5MzY5OTk0MDAwMTkyMIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAyqYa/TOBIm2cVN2+mCE6TGARwwe8C9eorVGz8MKQjwYX
dnuXh3BIw9mFDr4Hcc9iQgMVYHPDzT0lnTSQyU19Z26mV5ySR8vEi/kKr4FcojlI
eihlsXUPYwShbSq/f+BUJaHm+FPHqJ/GhCxQshcbSAlgoTfDFbXkG3iu4bCH29ta
mntePuEOY3VDiUMQOos5Xo0/lTPEkx8bZeEIQvZ2+7zBXZwK0CXWJEcfWaF4hJyr
hQ22xJBkjHhTt52zksJLvzHdByTfImTyyhIAwUSwlg7LFCFGT/UVOhqbEbJ3Bqyl
4LzwxT55ehnugc0toVoia58S6PL4TpyrTDNowDo9JQIDAQABo4IC0jCCAs4wCQYD
VR0TBAIwADAfBgNVHSMEGDAWgBTduLXdAty4UMp+BlRDwX78rvStezCBqAYIKwYB
BQUHAQEEgZswgZgwXQYIKwYBBQUHMAKGUWh0dHA6Ly93d3cuZGlnaXRhbHNpZ25j
ZXJ0aWZpY2Fkb3JhLmNvbS5ici9yZXBvc2l0b3Jpby9yZmIvQUNESUdJVEFMU0lH
TlJGQkczLnA3YjA3BggrBgEFBQcwAYYraHR0cDovL29jc3AuZGlnaXRhbHNpZ25j
ZXJ0aWZpY2Fkb3JhLmNvbS5icjBdBgNVHSAEVjBUMFIGBmBMAQIBLDBIMEYGCCsG
AQUFBwIBFjpodHRwOi8vd3d3LmRpZ2l0YWxzaWduY2VydGlmaWNhZG9yYS5jb20u
YnIvcmVwb3NpdG9yaW8vcmZiMB0GA1UdJQQWMBQGCCsGAQUFBwMCBggrBgEFBQcD
BDCBsQYDVR0fBIGpMIGmMFegVaBThlFodHRwOi8vd3d3LmRpZ2l0YWxzaWduY2Vy
dGlmaWNhZG9yYS5jb20uYnIvcmVwb3NpdG9yaW8vcmZiL0FDRElHSVRBTFNJR05S
RkJHMy5jcmwwS6BJoEeGRWh0dHA6Ly93d3cuZGlnaXRhbHRydXN0LmNvbS5ici9y
ZXBvc2l0b3Jpby9yZmIvQUNESUdJVEFMU0lHTlJGQkczLmNybDAOBgNVHQ8BAf8E
BAMCBeAwgbIGA1UdEQSBqjCBp4EUcmVkZW5mbHVAaG90bWFpbC5jb22gOAYFYEwB
AwSgLwQtMTkwNjE5ODY4NjAwMDczMDIyNTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAw
MDAwoCEGBWBMAQMCoBgEFlRISUFHTyBDT1NUQSBHVUlNQVJBRVOgGQYFYEwBAwOg
EAQOMDkzNjk5OTQwMDAxOTKgFwYFYEwBAwegDgQMMDAwMDAwMDAwMDAwMA0GCSqG
SIb3DQEBCwUAA4ICAQCKLMykXmH3MvvJ3TQKiyy4b/VSi++ttChQKOCkLa1Vp31U
u4vmM/SOXLlRhCJ8eDIV3JQfU6TyCNw6VzRjxTM8vOGV9U/UvO2czzPOQi7arKrN
5jFQm6scf6g8PROPi7TzcVlMtjBNcEstd5JlnSL2SL6rR9AcP6bXCEQzwqpPylwV
u2K+y/b8ejtmQF0T4Pqo1+Y4ZY2z1oyXQDuDD1ik3s9byM1yZdsc1ZpDY17Z3ofe
w1OBiXbwu8dbu+AjJZjWuezjMTxK592fDLkrc4yp5sabHfvF6ZpMl6VgNjGCcsJh
P0/Ux6JGIVpTs3R+GgctDM6TrKsIV4lRss/lSTH96/ZWB+Gi1fFAviR999Kfw13l
upMv/wgpAlrVO5BIspEuM3svBuqJa7mf0ZMDLIldTxIToOzU8HcwZeJufkaPHSz3
hUf0zQlFV/vQ/EJFjf/VA44DbftiO0bRklK2RzDFlMkWkD8yPVIr/NFULs62tsnY
dcAztn//TrZI3HlWP9tyqjvdZhs73WYJpYBQDIp10F/ybeFEmnsU7WC6cxv5uSoR
4F2UJ0oQ6YFxIsdKmpr96vHmhLhsPndkx0mzG36emf6XFYlp4caIxlVux73c5ANt
/LEFQa9d7WV4QK5Yowrvc8uv2J2nZWvTVRnF3CTAqY5lAsMSxYS7RFZpTS1PrQ==';

function jsonResponse($success, $message, $data = [])
{
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}
function removeSpecialCharacters($input)
{
    $charactersToRemove = array("(", ")", "-", ".", "/");
    $output = str_replace($charactersToRemove, "", $input);
    $output = str_replace(' ', '', $output);
    return $output;
}

function codigo_municipio_ibge($estado, $cidade)
{

    //codigo de cada estado segundo ibge
    $codigo_uf = array(
        "AC" => 12,
        "AL" => 27,
        "AP" => 16,
        "AM" => 13,
        "BA" => 29,
        "CE" => 23,
        "DF" => 53,
        "ES" => 32,
        "GO" => 52,
        "MA" => 21,
        "MT" => 51,
        "MS" => 50,
        "MG" => 31,
        "PA" => 15,
        "PB" => 25,
        "PR" => 41,
        "PE" => 26,
        "PI" => 22,
        "RJ" => 33,
        "RN" => 24,
        "RS" => 43,
        "RO" => 11,
        "RR" => 14,
        "SC" => 42,
        "SP" => 35,
        "SE" => 28,
        "TO" => 17
    );
    //link com o codigo do estado pedido
    $link_api = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/' . $codigo_uf[$estado] . '/municipios';

    $curl = curl_init();

    curl_setopt_array($curl, array(
        CURLOPT_URL => $link_api,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => 'GET',
    ));
    //resposta da api
    $response = curl_exec($curl);

    curl_close($curl);

    $array_response = json_decode($response, true);

    // var_dump($array_response);
    //Laço para percorrer o array até achar a cidade
    foreach ($array_response as $dados_cidade) {

        if ($dados_cidade['nome'] == $cidade) {
            //retorna apenas o codigo da cidade
            return $dados_cidade["id"];
        }
    }
}

function cria_xml_nf($num_lote, $cnpj_prestador, $inscricao_municipal, $data_emissao, $valor_servico, $aliquota, $valor_iss, $reter_iss, $item_lista_servico, $cod_cnae, $cod_tributacao_municipio, $descricao_servico, $codigo_ibge, $exigibilidade_iss, $cnpj_tomador, $razao_soc_tomador, $endereco, $numero, $complemento, $bairro, $cod_municipio_tomador, $uf_tomador, $cep_tomador, $telefone_tomador, $email_tomador, $simples_nacional, $incentivo_fiscal, $certificado)
{

    // Definindo o nome do arquivo
    $nomeArquivo = 'nfse_desenvolve_cidade.xml';

    // Criando uma nova instância de DOMDocument
    $dom = new DOMDocument('1.0', 'UTF-8');

    // Criando os elementos iniciais conforme a estrutura SOAP especificada
    $envelope = $dom->createElement('soapenv:Envelope');
    $envelope->setAttribute('xmlns:soapenv', 'http://schemas.xmlsoap.org/soap/envelope/');
    $envelope->setAttribute('xmlns:ws', 'http://ws.integracao.nfsd.desenvolve/');
    $dom->appendChild($envelope);

    $body = $dom->createElement('soapenv:Body');
    $envelope->appendChild($body);

    $envio = $dom->createElement('ws:enviarLoteRpsSincronoEnvio');
    $body->appendChild($envio);

    $xmlElement = $dom->createElement('xml');
    $envio->appendChild($xmlElement);


    // Adicionando um CDATA section para o XML interno
    $cdata = $dom->createCDATASection('

	<EnviarLoteRpsSincronoEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
			<LoteRps Id="Lote_' . $num_lote . '" versao="2.03">
			<NumeroLote>' . $num_lote . '</NumeroLote>
			<CpfCnpj>
				<Cnpj>' . $cnpj_prestador . '</Cnpj>
			</CpfCnpj>
			<InscricaoMunicipal>' . $inscricao_municipal . '</InscricaoMunicipal>
			<QuantidadeRps>1</QuantidadeRps>
			<ListaRps>
			<Rps>
				<InfDeclaracaoPrestacaoServico Id="RPS">
					<Rps>
						<IdentificacaoRps>
							<Numero>' . $num_lote . '</Numero>
							<Serie>' . $num_lote . '</Serie>
							<Tipo>1</Tipo>
						</IdentificacaoRps>
						<DataEmissao>' . $data_emissao . '</DataEmissao>
						<Status>1</Status>
					</Rps>
					<Competencia>' . $data_emissao . '</Competencia>
					<Servico>
						<Valores>
							<ValorServicos>' . $valor_servico . '</ValorServicos>
							<ValorIss>' . $valor_iss . '</ValorIss>
							<Aliquota>' . $aliquota . '</Aliquota>
						</Valores>
						<IssRetido>' . $reter_iss . '</IssRetido>
						<ResponsavelRetencao>1.00</ResponsavelRetencao>
						<ItemListaServico>' . $item_lista_servico . '</ItemListaServico>
						<CodigoCnae>' . $cod_cnae . '</CodigoCnae>
						<CodigoTributacaoMunicipio>' . $cod_tributacao_municipio . '</CodigoTributacaoMunicipio>
						<Discriminacao>' . $descricao_servico . '</Discriminacao>
						<CodigoMunicipio>' . $codigo_ibge . '</CodigoMunicipio>
						<ExigibilidadeISS>' . $exigibilidade_iss . '</ExigibilidadeISS>
						<MunicipioIncidencia>' . $codigo_ibge . '</MunicipioIncidencia>
					</Servico>
					<Prestador>
						<CpfCnpj>
							<Cnpj>' . $cnpj_prestador . '</Cnpj>
						</CpfCnpj>
						<InscricaoMunicipal>' . $inscricao_municipal . '</InscricaoMunicipal>
					</Prestador>
					<Tomador>
						<IdentificacaoTomador>
							<CpfCnpj>
								<Cnpj>' . $cnpj_tomador . '</Cnpj>
							</CpfCnpj>
						</IdentificacaoTomador>
						<RazaoSocial>' . $razao_soc_tomador . '</RazaoSocial>
						<Endereco>
							<Endereco>' . $endereco . '</Endereco>
							<Numero>' . $numero . '</Numero>
							<Complemento>' . $complemento . '</Complemento>
							<Bairro>' . $bairro . '</Bairro>
							<CodigoMunicipio>' . $cod_municipio_tomador . '</CodigoMunicipio>
							<Uf>' . $uf_tomador . '</Uf>
							<CodigoPais>1058</CodigoPais>
							<Cep>' . $cep_tomador . '</Cep>
						</Endereco>
						<Contato>
							<Telefone>' . $telefone_tomador . '</Telefone>
							<Email>' . $email_tomador . '</Email>
						</Contato>
					</Tomador>
					<OptanteSimplesNacional>' . $simples_nacional . '</OptanteSimplesNacional>
					<IncentivoFiscal>' . $incentivo_fiscal . '</IncentivoFiscal>
				</InfDeclaracaoPrestacaoServico>
				<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
					<SignedInfo>
						<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
						<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
						<Reference URI="#RPS">
							<Transforms>
								<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
								<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
							</Transforms>
							<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
							<DigestValue>SgT+SE8rqviL3d9W=</DigestValue>
						</Reference>
					</SignedInfo>
					<SignatureValue>k1Pz/dNiDpZP1RfCWRLytwv/Pyzpmib3/7tTyAO/t65zvcGvA7b5JCH9AsIVIisMxWnQceq7fkFltOdsU1QwyOig8A3EiOdVLl+SDDA==</SignatureValue>
					<KeyInfo>
						<X509Data>
							<X509Certificate>' . $certificado . '</X509Certificate>
						</X509Data>
					</KeyInfo>
				</Signature>
			</Rps>
		</ListaRps>
		</LoteRps>
		<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
			<SignedInfo>
				<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
				<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
				<Reference URI="#Lote_1">
					<Transforms>
						<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
						<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
					</Transforms>
					<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
					<DigestValue>BMZEDBMXinrMKvN1Zxq4IeHuLwc=</DigestValue>
				</Reference>
			</SignedInfo>
			<SignatureValue>ZbJ+msPTU4AqlOCbEkSrc2eAkEJyH7eRNnYWUThCreH47aQYs0cq3V4h3rbjnylQBP0zLiUucwa2kdEkU73HVDeKhnOSuGzixU0aF7ibVjZ6NrMwiJXDut8RawYYpAprhKdKp3meIp9frO/BFAqcEdfe9JrdwDmKv8QykDZJkjEPK0KZbrvuvpQxZCvQQhw88AC028InSy/k5FpEgV4a2DiostQeSq2H+VKMkd6GV/7/UYp3gyzptsvLUVPEO0iw0pcwvGZVXJi6uXzbVkXVY5+aGZJnTQtz2yY33JIpsqsDbhnJrnSNJPNK1Ge5wMH4zy8uVmxA4cGprNsw4Q0f8g==</SignatureValue>
			<KeyInfo>
				<X509Data>
					<X509Certificate>' . $certificado . '</X509Certificate>
				</X509Data>
			</KeyInfo>
		</Signature>
	</EnviarLoteRpsSincronoEnvio>

	');
    $xmlElement->appendChild($cdata);

    // Salvando o XML em um arquivo
    $dom->formatOutput = true;
    if ($dom->save($nomeArquivo)) {
        return 'ok';
    } else {
        return "Erro: Não foi possível criar o arquivo XML.";
    }
}

function emite_nf_desenvolve_cidade()
{

    // URL da API para onde você deseja enviar o XML

    #producao
    $url = "https://redencao-pa.desenvolvecidade.com.br/nfsd/IntegracaoNfsd?wsdl";

    #homologacao
    // $url = "https://hml-01-redencao-pa.desenvolvecidade.com.br/nfsd/IntegracaoNfsd?wsdl";

    // Caminho para o arquivo XML que você deseja enviar
    $xml_file_path = 'nfse_desenvolve_cidade.xml';

    // Inicializa a sessão cURL
    $ch = curl_init();

    // Configura as opções da requisição cURL
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents($xml_file_path)); // Lê o conteúdo do arquivo XML
    curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/xml'));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);


    // Executa a requisição e obtém a resposta
    $response = curl_exec($ch);

    /* gravando_log_nf('Retorno' . $response); */

    // Verifica por erros
    if (curl_errno($ch)) {
        echo 'Erro ao enviar a requisição: ' . curl_error($ch);
    }

    // Fecha a sessão cURL
    curl_close($ch);

    // return $response;


    //Me deve um açai 
    // echo "O codigo de verificação é: -[" . rtrim($Codigo_verificacao) . ']';


    // Remover caracteres indesejados e espaços em branco no início e no final
    $response = trim($response);

    // Verificar e limpar possíveis caracteres UTF-8 BOM
    $response = preg_replace('/^\xEF\xBB\xBF/', '', $response);

    // Detectar a codificação e converter para UTF-8, se necessário
    $encoding = mb_detect_encoding($response, 'UTF-8, ISO-8859-1', true);
    if ($encoding !== 'UTF-8') {
        $response = mb_convert_encoding($response, 'UTF-8', $encoding);
    }

    // Verificar se a resposta não está vazia
    if (empty($response)) {
        echo "A resposta do cURL está vazia.";
        exit;
    }

    // Carregar a resposta XML
    $dom = new DOMDocument();
    if (!$dom->loadXML($response)) {
        echo "Erro ao carregar o XML.";
        exit;
    }

    $palavra = "MensagemRetorno";

    if (contemPalavra($response, $palavra)) {

        //pegando o crente e separando para um array 
        $Resultando_final = explode('Mensagem', $response);

        //removendo caractes que vem junto
        $erro_retornado = trim(str_replace(['<', '>', '/', '</'], '', $Resultando_final[3]));

        //tirando os espaços que vem junto
        // $erro_retornado = substr($erro_retornado, 0, -4);

        return "erro||" . $erro_retornado;
    } else {

        //pegando o crente e separando para um array 
        $Resultando_final = explode('CodigoVerificacao', $response);
        $result = explode('Numero>', $response);
        //removendo caractes que vem junto
        $Codigo_verificacao = trim(str_replace(['<', '>', '/', '</'], '', $Resultando_final[1]));
        $numeroNota = trim(str_replace(['<', '>', '/', '</'], '', $result[1]));
        //tirando os espaços que vem junto
        $Codigo_verificacao = substr($Codigo_verificacao, 0, -4);
        $numeroNota = substr($numeroNota, 0, -4);

        return "ok||" . $Codigo_verificacao . "||" . $numeroNota;


    }
}

function contemPalavra($string, $palavra)
{
    // Verifica se a palavra está presente na string usando strpos
    if (strpos($string, $palavra) !== false) {
        return true;
    } else {
        return false;
    }
}

function envia_Email()
{
}
;

$array_msg = array();


/* $dados_notas_fiscais = $this->core->Fetch("SELECT * FROM `notas_fiscais` WHERE `emissor`='nota_desenvolve_cidade' ORDER BY `notas_fiscais`.`id` ASC LIMIT 1"); */



// ======================= INÍCIO DO PROCESSAMENTO =======================

try {
    // Validação do método HTTP
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonResponse(false, 'Método não permitido. Use POST.');
    }

    // Função de limpeza
    function clean($value)
    {
        return htmlspecialchars(trim($value), ENT_QUOTES, 'UTF-8');
    }

    // ======================= OBTER NÚMERO DE LOTE =======================
    $r = curl_init("https://painel.cloudx.com.br/Lote_consultar.desenvolver.city.php");
    curl_setopt_array($r, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => ["token" => "d6561918-25d1-47f3-be8f-5d4f5bd37dff"]
    ]);
    $j = json_decode(curl_exec($r), true);
    curl_close($r);

    if (!$j || $j['erro']) {
        jsonResponse(false, $j['mensagem'] ?? 'Erro ao obter número de lote');
    }

    $num_lote = $j['numero_lote_disponivel'];

    // ======================= DADOS DO PRESTADOR =======================
    $cnpj_prestador = removeSpecialCharacters('09.369.994/0001-92');
    $inscricao_municipal = '32801';
    $data_emissao = date('Y-m-d');
    $valor_servico = clean($_POST['valor_servico'] ?? '0');
    $aliquota = clean($_POST['aliquota'] ?? '2.47');
    $aliquota_div = floatval($aliquota) / 100;
    $valor_iss = number_format(floatval($valor_servico) * $aliquota_div, 2, '.', '');
    $reter_iss = clean($_POST['reter_iss'] ?? '2');
    $nfse_itemlistaservico = clean($_POST['item_lista_servico'] ?? '01.03');
    $cod_cnae = clean($_POST['cod_cnae'] ?? '6311900');
    $descricao_servico = clean($_POST['descricao_servico'] ?? 'Servicos de IA e webhosting.');
    $codigo_ibge_prestador = '1506138';
    $cod_tributacao_municipio = clean($_POST['cod_tributacao_municipio'] ?? '01.03');
    $exigibilidade_iss = clean($_POST['exigibilidade_iss'] ?? '2');
    $simples_nacional = clean($_POST['simples_nacional'] ?? '1');
    $incentivo_fiscal = clean($_POST['incentivo_fiscal'] ?? '2');


    // ======================= DADOS DO TOMADOR =======================
    $cnpj_cpf = removeSpecialCharacters(clean($_POST['cnpj_cpf'] ?? ''));
    $raz_soc_tom = clean($_POST['razao_social'] ?? '');
    $endereco = clean($_POST['endereco'] ?? '');
    $numero = clean($_POST['numero'] ?? 'S/N');
    $complemento = clean($_POST['complemento'] ?? '');
    $bairro = clean($_POST['bairro'] ?? '');
    $cod_municipio_tomador = clean($_POST['cod_municipio'] ?? '');
    $uf_tomador = clean($_POST['uf'] ?? '');
    $cep_tomador = removeSpecialCharacters(clean($_POST['cep'] ?? ''));
    $telefone_tomador = removeSpecialCharacters(clean($_POST['telefone'] ?? ''));
    $email_tomador = clean($_POST['email'] ?? '');

    // Validações básicas
    if (empty($cnpj_cpf)) {
        jsonResponse(false, 'CPF/CNPJ do tomador é obrigatório');
    }

    if (empty($raz_soc_tom)) {
        jsonResponse(false, 'Razão social do tomador é obrigatória');
    }

    if (empty($valor_servico) || floatval($valor_servico) <= 0) {
        jsonResponse(false, 'Valor do serviço inválido');
    }

    // Ajuste do telefone
    if (strlen($telefone_tomador) > 11) {
        $telefone_tomador = substr($telefone_tomador, 0, 11);
    } elseif (strlen($telefone_tomador) < 10) {
        $telefone_tomador = str_pad($telefone_tomador, 10, "0", STR_PAD_RIGHT);
    }

    // ======================= CRIAR XML =======================
    $creat_xml_result = cria_xml_nf(
        $num_lote,
        $cnpj_prestador,
        $inscricao_municipal,
        $data_emissao,
        $valor_servico,
        $aliquota,
        $valor_iss,
        $reter_iss,
        $nfse_itemlistaservico,
        $cod_cnae,
        $cod_tributacao_municipio,
        $descricao_servico,
        $codigo_ibge_prestador,
        $exigibilidade_iss,
        $cnpj_cpf,
        $raz_soc_tom,
        $endereco,
        $numero,
        $complemento,
        $bairro,
        $cod_municipio_tomador,
        $uf_tomador,
        $cep_tomador,
        $telefone_tomador,
        $email_tomador,
        $simples_nacional,
        $incentivo_fiscal,
        $certificado_txt
    );


    if ($creat_xml_result != 'ok') {
        jsonResponse(false, $creat_xml_result);
        exit;
    }

    // ======================= EMITIR NOTA FISCAL =======================
    $envia_nf = emite_nf_desenvolve_cidade();

    // Verifica se houve erro
    if (strpos($envia_nf, 'erro||') !== false) {

        jsonResponse(false, 'Erro ao emitir NFSe', $envia_nf);
        exit;
    }

    print_r($envia_nf);

    // Remove o arquivo XML temporário
    if (file_exists($xml_nota)) {
        @unlink($xml_nota);
    }

    if (!$envia_nf['success']) {
        jsonResponse(false, 'Erro ao emitir nota fiscal: ' . $envia_nf['error']);
    }

    // ======================= SUCESSO =======================

    // Extrai apenas a parte JSON
    $json_inicio = strpos($envia_nf_raw, '{');
    $json_texto = substr($envia_nf_raw, $json_inicio);

    // Decodifica para array
    $envia_nf = json_decode($json_texto, true);

    // Se deu erro no JSON
    if (!$envia_nf || !isset($envia_nf['data'])) {
        jsonResponse(false, 'Erro ao interpretar retorno da NF', [
            'retorno_bruto' => $envia_nf_raw
        ]);
        exit;
    }

    // Acesso aos campos
    $numero_nota = $envia_nf['data']['numero_nota'];
    $codigo_verificacao = $envia_nf['data']['codigo_verificacao'];

    // Monta link
    $link = 'https://redencao-pa.desenvolvecidade.com.br/nfsd/pages/consulta/notaFiscal/consultarAutenticidadeNotaFiscal.jsf'
        . '?cnpj=' . $cnpj_prestador
        . '&notaFiscal=' . $numero_nota
        . '&codigoVerificacao=' . $codigo_verificacao;

    // Retorno final bonito
    jsonResponse(true, 'Nota fiscal emitida com sucesso', [
        'numero_nota' => $numero_nota,
        'codigo_verificacao' => $codigo_verificacao,
        'link' => $link,
        'numero_lote' => $num_lote
    ]);
} catch (Exception $e) {
    jsonResponse(false, 'Erro interno: ' . $e->getMessage());
}
?>