import fetch from "node-fetch";

export async function gerandonotafiscalPOST(req, res) {
  try {
    const {
      valor_servico,
      cnpj_cpf,
      razao_social,
      endereco,
      bairro,
      cod_municipio,
      uf,
      cep,
      telefone,
      email
    } = req.body;

    // Valores padrões
    const CEP_PADRAO = "68553-170";
    const COD_MUNICIPIO_PADRAO = "1506138";

    // ----------------------------------------------------------------------------------
    // 🔍 1. VALIDAÇÃO DO CEP VIA API VIACEP
    // ----------------------------------------------------------------------------------
    let cepFinal = CEP_PADRAO;
    let cepSomenteNumeros = cep ? cep.replace(/\D/g, "") : "";

    if (cepSomenteNumeros.length === 8) {
      const cepCheck = await fetch(`https://viacep.com.br/ws/${cepSomenteNumeros}/json/`);
      const cepJson = await cepCheck.json();

      if (!cepJson.erro) {
        cepFinal = cepSomenteNumeros; // válido!
      }
    }

    // ----------------------------------------------------------------------------------
    // 🔍 2. VALIDAÇÃO DO CÓDIGO DO MUNICÍPIO VIA API IBGE
    // ----------------------------------------------------------------------------------
    let codMunicipioFinal = COD_MUNICIPIO_PADRAO;

    if (cod_municipio && /^[0-9]+$/.test(cod_municipio)) {
      const ibgeCheck = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${cod_municipio}`
      );

      if (ibgeCheck.status === 200) {
        const ibgeJson = await ibgeCheck.json();
        if (ibgeJson && ibgeJson.id) {
          codMunicipioFinal = cod_municipio; // válido!
        }
      }
    }

    // ----------------------------------------------------------------------------------
    // 🔍 3. MONTANDO DADOS DO POST EM FORM-URLENCODED
    // ----------------------------------------------------------------------------------
    const formData = new URLSearchParams();
    formData.append("valor_servico", valor_servico);
    formData.append("cnpj_cpf", cnpj_cpf);
    formData.append("razao_social", razao_social);
    formData.append("endereco", endereco);
    formData.append("bairro", bairro);
    formData.append("cod_municipio", codMunicipioFinal);
    formData.append("uf", uf);
    formData.append("cep", cepFinal);
    formData.append("telefone", telefone);
    formData.append("email", email);

    // ----------------------------------------------------------------------------------
    // 🔍 4. FAZENDO O POST PARA SUA API DE NOTA
    // ----------------------------------------------------------------------------------
    const response = await fetch("https://sitexpres.com.br/notafiscal/index.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString(),
    });

    const result = await response.text();

    return res.json({
      status: true,
      message: "Requisição enviada com sucesso",
      cepUsado: cepFinal,
      municipioUsado: codMunicipioFinal,
      retorno: result,
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Erro ao emitir nota",
      error: error.message,
    });
  }
}
