import fs from "fs";
import axios from "axios";
import https from 'https';
import { create } from "xmlbuilder2";
import { parseStringPromise } from "xml2js";
import dotenv from "dotenv";
dotenv.config();

// ----------------------------------------------------------------------
// REMOVE CARACTERES ESPECIAIS
// ----------------------------------------------------------------------
function removeSpecialCharacters(input = "") {
  return String(input)
    .replace(/[()\-.\/]/g, "")
    .replace(/\s+/g, "")
    .replace(/,/g, "")
    .replace(/[^0-9]/g, "");
}

// ----------------------------------------------------------------------
// CRIAR XML DA NFSE
// ----------------------------------------------------------------------
export function criarXmlNF(data) {
    const {
        num_lote,
        cnpj_prestador,
        inscricao_municipal,
        data_emissao,
        valor_servico,
        aliquota,
        valor_iss,
        reter_iss,
        item_lista_servico,
        cod_cnae,
        cod_tributacao_municipio,
        descricao_servico,
        codigo_ibge,
        exigibilidade_iss,
        cnpj_tomador,
        razao_soc_tomador,
        endereco,
        numero,
        complemento,
        bairro,
        cod_municipio_tomador,
        uf_tomador,
        cep_tomador,
        telefone_tomador,
        email_tomador,
        simples_nacional,
        incentivo_fiscal,
        certificado
    } = data;

    const xmlInterno = `
<EnviarLoteRpsSincronoEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
    <LoteRps Id="Lote_${num_lote}" versao="2.03">
        <NumeroLote>${num_lote}</NumeroLote>
        <CpfCnpj>
            <Cnpj>${cnpj_prestador}</Cnpj>
        </CpfCnpj>
        <InscricaoMunicipal>${inscricao_municipal}</InscricaoMunicipal>
        <QuantidadeRps>1</QuantidadeRps>
        <ListaRps>
            <Rps>
                <InfDeclaracaoPrestacaoServico Id="RPS">
                    <Rps>
                        <IdentificacaoRps>
                            <Numero>${num_lote}</Numero>
                            <Serie>${num_lote}</Serie>
                            <Tipo>1</Tipo>
                        </IdentificacaoRps>
                        <DataEmissao>${data_emissao}</DataEmissao>
                        <Status>1</Status>
                    </Rps>
                    <Competencia>${data_emissao}</Competencia>
                    <Servico>
                        <Valores>
                            <ValorServicos>${valor_servico}</ValorServicos>
                            <ValorIss>${valor_iss}</ValorIss>
                            <Aliquota>${aliquota}</Aliquota>
                        </Valores>
                        <IssRetido>${reter_iss}</IssRetido>
                        <ResponsavelRetencao>1.00</ResponsavelRetencao>
                        <ItemListaServico>${item_lista_servico}</ItemListaServico>
                        <CodigoCnae>${cod_cnae}</CodigoCnae>
                        <CodigoTributacaoMunicipio>${cod_tributacao_municipio}</CodigoTributacaoMunicipio>
                        <Discriminacao>${descricao_servico}</Discriminacao>
                        <CodigoMunicipio>${codigo_ibge}</CodigoMunicipio>
                        <ExigibilidadeISS>${exigibilidade_iss}</ExigibilidadeISS>
                        <MunicipioIncidencia>${codigo_ibge}</MunicipioIncidencia>
                    </Servico>
                    <Prestador>
                        <CpfCnpj>
                            <Cnpj>${cnpj_prestador}</Cnpj>
                        </CpfCnpj>
                        <InscricaoMunicipal>${inscricao_municipal}</InscricaoMunicipal>
                    </Prestador>
                    <Tomador>
                        <IdentificacaoTomador>
                            <CpfCnpj>
                                <Cnpj>${cnpj_tomador}</Cnpj>
                            </CpfCnpj>
                        </IdentificacaoTomador>
                        <RazaoSocial>${razao_soc_tomador}</RazaoSocial>
                        <Endereco>
                            <Endereco>${endereco}</Endereco>
                            <Numero>${numero}</Numero>
                            <Complemento>${complemento}</Complemento>
                            <Bairro>${bairro}</Bairro>
                            <CodigoMunicipio>${cod_municipio_tomador}</CodigoMunicipio>
                            <Uf>${uf_tomador}</Uf>
                            <CodigoPais>1058</CodigoPais>
                            <Cep>${cep_tomador}</Cep>
                        </Endereco>
                        <Contato>
                            <Telefone>${telefone_tomador}</Telefone>
                            <Email>${email_tomador}</Email>
                        </Contato>
                    </Tomador>
                    <OptanteSimplesNacional>${simples_nacional}</OptanteSimplesNacional>
                    <IncentivoFiscal>${incentivo_fiscal}</IncentivoFiscal>

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
                                <X509Certificate>${certificado}</X509Certificate>
                            </X509Data>
                        </KeyInfo>
                    </Signature>
                </InfDeclaracaoPrestacaoServico>

                <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
                    <SignedInfo>
                        <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
                        <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
                        <Reference URI="#Lote_${num_lote}">
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
                            <X509Certificate>${certificado}</X509Certificate>
                        </X509Data>
                    </KeyInfo>
                </Signature>

            </Rps>
        </ListaRps>
    </LoteRps>
</EnviarLoteRpsSincronoEnvio>
`;

    // Envelope SOAP
    const xmlFinal = create()
        .ele("soapenv:Envelope", {
            "xmlns:soapenv": "http://schemas.xmlsoap.org/soap/envelope/",
            "xmlns:ws": "http://ws.integracao.nfsd.desenvolve/"
        })
        .ele("soapenv:Body")
        .ele("ws:enviarLoteRpsSincronoEnvio")
        .ele("xml")
        .dat(xmlInterno)
        .end({ prettyPrint: true });

    fs.writeFileSync("nfse_desenvolve_cidade.xml", xmlFinal);

    return xmlFinal;
}

// ----------------------------------------------------------------------
// ENVIA XML PARA API DA PREFEITURA COM DEBUG E RETRY
// ----------------------------------------------------------------------
async function enviarXmlParaPrefeitura() {
  const url = "https://redencao-pa.desenvolvecidade.com.br/nfsd/IntegracaoNfsd?wsdl";
  
  try {
    console.log('\n=== INÍCIO DO ENVIO DA NF ===');
    console.log('URL:', url);
    console.log('Timestamp:', new Date().toISOString());
    
    // Ler XML
    console.log('\n[1] Lendo arquivo XML...');
    const xml = fs.readFileSync("nfse_desenvolve_cidade.xml", "utf8");
    
    // Debug do XML
    const xmlSize = Buffer.byteLength(xml, 'utf8');
    console.log('Tamanho do XML:', xmlSize, 'bytes');
    console.log('Primeiros 200 caracteres:', xml.substring(0, 200));
    console.log('Últimos 100 caracteres:', xml.substring(xml.length - 100));
    
    // Configuração do request
    console.log('\n[2] Configurando request...');
    const config = {
      headers: {
        "Content-Type": "application/xml",
        "Content-Length": xmlSize,
        "SOAPAction": ""
      },
      timeout: 90000, // 90 segundos
      httpsAgent: new https.Agent({
        keepAlive: true,
        keepAliveMsecs: 1000,
        timeout: 90000,
        rejectUnauthorized: false // Pode ser necessário para alguns servidores
      }),
      maxRedirects: 5,
      validateStatus: function (status) {
        console.log('Status HTTP recebido:', status);
        return status >= 200 && status < 600; // Aceita todos os status para debug
      }
    };
    
    console.log('Headers:', JSON.stringify(config.headers, null, 2));
    console.log('Timeout configurado:', config.timeout, 'ms');
    
    // Enviar request
    console.log('\n[3] Enviando request...');
    const startTime = Date.now();
    
    const response = await axios.post(url, xml, config);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('\n[4] Resposta recebida!');
    console.log('Tempo de resposta:', duration, 'ms');
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Headers da resposta:', JSON.stringify(response.headers, null, 2));
    
    // Debug do response data
    console.log('\n[5] Dados da resposta:');
    console.log('Tipo:', typeof response.data);
    
    if (typeof response.data === 'string') {
      console.log('Tamanho da resposta:', response.data.length, 'caracteres');
      console.log('Primeiros 500 caracteres:', response.data.substring(0, 500));
      if (response.data.length > 500) {
        console.log('Últimos 200 caracteres:', response.data.substring(response.data.length - 200));
      }
    } else {
      console.log('Resposta (JSON):', JSON.stringify(response.data, null, 2));
    }
    
    console.log('\n=== SUCESSO ===\n');
    return response.data;
    
  } catch (error) {
    console.error('\n=== ERRO AO ENVIAR NF ===');
    console.error('Timestamp:', new Date().toISOString());
    
    if (error.response) {
      console.error('\n[ERRO] Resposta do servidor:');
      console.error('Status:', error.response.status);
      console.error('Status Text:', error.response.statusText);
      console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('Data:', error.response.data);
      
    } else if (error.request) {
      console.error('\n[ERRO] Sem resposta do servidor');
      console.error('Código do erro:', error.code);
      console.error('Mensagem:', error.message);
      console.error('Request config:', {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
        timeout: error.config?.timeout
      });
      
      if (error.code === 'ECONNRESET') {
        console.error('\n⚠️  ECONNRESET: Servidor fechou a conexão inesperadamente');
        console.error('Possíveis causas:');
        console.error('  - Timeout do servidor');
        console.error('  - XML inválido ou muito grande');
        console.error('  - Servidor sobrecarregado');
        console.error('  - Problemas de rede/firewall');
      } else if (error.code === 'ETIMEDOUT') {
        console.error('\n⚠️  ETIMEDOUT: Tempo limite excedido');
      } else if (error.code === 'ENOTFOUND') {
        console.error('\n⚠️  ENOTFOUND: Servidor não encontrado (DNS)');
      }
      
    } else {
      console.error('\n[ERRO] Erro na configuração:');
      console.error('Mensagem:', error.message);
    }
    
    console.error('\n[STACK TRACE]');
    console.error(error.stack);
    console.error('\n=== FIM DO ERRO ===\n');
    
    throw error;
  }
}

// ----------------------------------------------------------------------
// FUNÇÃO COM RETRY AUTOMÁTICO
// ----------------------------------------------------------------------
async function enviarComRetry(maxTentativas = 3) {
  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`>>> TENTATIVA ${tentativa} de ${maxTentativas} <<<`);
      console.log('='.repeat(60));
      
      const resultado = await enviarXmlParaPrefeitura();
      
      console.log(`\n✅ Sucesso na tentativa ${tentativa}!`);
      return resultado;
      
    } catch (error) {
      console.error(`\n❌ Falha na tentativa ${tentativa}`);
      
      if (tentativa < maxTentativas) {
        const aguardar = 3000 * tentativa; // 3s, 6s, 9s
        console.log(`⏳ Aguardando ${aguardar}ms antes da próxima tentativa...\n`);
        await new Promise(resolve => setTimeout(resolve, aguardar));
      } else {
        console.error('\n❌ Todas as tentativas falharam!');
        throw error;
      }
    }
  }
}

// ----------------------------------------------------------------------
// INTERPRETAR RESPOSTA DA PREFEITURA
// ----------------------------------------------------------------------
async function interpretarResposta(xmlResposta) {
  try {
    console.log('\n[6] Interpretando resposta...');
    
    const xmlLimpo = xmlResposta.trim().replace(/^\xEF\xBB\xBF/, "");

    const parsed = await parseStringPromise(xmlLimpo, { explicitArray: false });

    const body =
      parsed["soapenv:Envelope"]?.["soapenv:Body"] ||
      parsed["soap:Envelope"]?.["soap:Body"] ||
      parsed["Envelope"]?.["Body"];

    if (!body) {
      console.error('❌ Resposta inválida da prefeitura - Body não encontrado');
      return { erro: "Resposta inválida da prefeitura" };
    }

    const retorno = JSON.stringify(body);

    console.log("\n======RETORNO COMPLETO======");
    console.log(retorno);
    console.log("============================\n");

    if (retorno.includes("MensagemRetorno")) {
      const matchErro = retorno.match(/MensagemRetorno":"([^"]+)"/);
      const erro = matchErro ? matchErro[1] : "Erro desconhecido";
      console.error('❌ Erro retornado pela prefeitura:', erro);
      return { erro };
    }

    const cod = retorno.match(/CodigoVerificacao":"([^"]+)"/);
    const numero = retorno.match(/Numero":"([^"]+)"/);

    const resultado = {
      status: "ok",
      codigo_verificacao: cod ? cod[1] : null,
      numero_nota: numero ? numero[1] : null
    };

    console.log('✅ NF gerada com sucesso!');
    console.log('Código de Verificação:', resultado.codigo_verificacao);
    console.log('Número da Nota:', resultado.numero_nota);

    return resultado;
  } catch (error) {
    console.error('❌ Erro ao interpretar resposta:', error.message);
    throw error;
  }
}

// ----------------------------------------------------------------------
// CONTROLLER PRINCIPAL — RECEBE POST
// ----------------------------------------------------------------------
export async function gerarNF(req, res) {
  try {
    const dados = req.body;

    if (!dados || Object.keys(dados).length === 0) {
      return res.status(400).json({ erro: "Nenhum dado enviado no POST" });
    }

    console.log('\n🚀 Iniciando geração de NF...');
    console.log('Dados recebidos:', JSON.stringify(dados, null, 2));

    // Limpar campos
    dados.cnpj_prestador = removeSpecialCharacters(dados.cnpj_prestador);
    dados.cnpj_tomador = removeSpecialCharacters(dados.cnpj_tomador);
    dados.cep_tomador = removeSpecialCharacters(dados.cep_tomador);
    dados.telefone_tomador = removeSpecialCharacters(dados.telefone_tomador);
    dados.certificado = process.env.CERTIFICADO;

    // Criar XML
    console.log('\n📝 Criando XML...');
    criarXmlNF(dados);

    // Enviar para prefeitura com retry
    console.log('\n📤 Enviando para prefeitura...');
    const resposta = await enviarComRetry(3);

    // Interpretar retorno
    const resultado = await interpretarResposta(resposta);

    return res.json(resultado);

  } catch (e) {
    console.error("\n💥 ERRO AO GERAR NF:", e);
    return res.status(500).json({
      status: false,
      erro: e.message,
      detalhes: e.code || 'ERRO_DESCONHECIDO'
    });
  }
}