import fetch from "node-fetch";

export async function gerandonotafiscal(data) {
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
    } = data;

    // Valores padrões
    const CEP_PADRAO = "68553-170";
    const COD_MUNICIPIO_PADRAO = "1506138";

    // ---------------------------
    // 1. VALIDAR CEP NA VIA CEP
    // ---------------------------
    let cepFinal = CEP_PADRAO;
    let apenasNumeros = cep ? cep.replace(/\D/g, "") : "";

    if (apenasNumeros.length === 8) {
      const via = await fetch(`https://viacep.com.br/ws/${apenasNumeros}/json/`);
      const viaJson = await via.json();

      if (!viaJson.erro) {
        cepFinal = apenasNumeros;
      }
    }

    // ---------------------------
    // 2. VALIDAR MUNICÍPIO NO IBGE
    // ---------------------------
    let codMunicipioFinal = COD_MUNICIPIO_PADRAO;

    if (cod_municipio && /^[0-9]+$/.test(cod_municipio)) {
      const ibge = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${cod_municipio}`
      );

      if (ibge.status === 200) {
        const json = await ibge.json();
        if (json && json.id) {
          codMunicipioFinal = cod_municipio;
        }
      }
    }

    // ---------------------------
    // 3. MONTAR FORM-URLENCODED
    // ---------------------------
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

    // ---------------------------
    // 4. ENVIAR PARA SUA API
    // ---------------------------
    const response = await fetch("https://sitexpres.com.br/notafiscal/index.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const retorno = await response.text();

    return {
      status: true,
      message: "NF enviada com sucesso",
      dados_enviados: formData,
      resposta_nf: retorno,
      municipio_usado: codMunicipioFinal,
      cep_usado: cepFinal
    };

  } catch (error) {
    return {
      status: false,
      message: "Erro ao gerar nota",
      error: error.message
    };
  }
}
