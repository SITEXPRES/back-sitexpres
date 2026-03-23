# DTO Migration Guide: spatie/laravel-data → spatie/data-transfer-object

## Overview

We've migrated from `spatie/laravel-data` to `spatie/data-transfer-object` to remove the dependency on Laravel's service container. This package works in standalone PHP environments without requiring Laravel helpers.

## Key Differences

### 1. **Constructor Syntax**

**OLD (spatie/laravel-data):**

```php
$dto = new InfDpsData(
    id: 'DPS123',
    tipoAmbiente: 2,
    dataEmissao: '2023-01-01',
    // ... other properties
);
```

**NEW (spatie/data-transfer-object):**

```php
$dto = new InfDpsData([
    '@Id' => 'DPS123',           // Use MapFrom attribute value
    'tpAmb' => 2,                // XML element name, not PHP property name
    'dhEmi' => '2023-01-01',
    // ... other properties
]);
```

### 2. **Property Mapping**

You **MUST** use the XML element names (from `#[MapFrom()]` attributes) as array keys, not the PHP property names.

#### Common Mappings:

| PHP Property          | MapFrom Value | Array Key    |
| --------------------- | ------------- | ------------ |
| `$id`                 | `@Id`         | `'@Id'`      |
| `$tipoAmbiente`       | `tpAmb`       | `'tpAmb'`    |
| `$dataEmissao`        | `dhEmi`       | `'dhEmi'`    |
| `$versaoAplicativo`   | `verAplic`    | `'verAplic'` |
| `$serie`              | `serie`       | `'serie'`    |
| `$numeroDps`          | `nDPS`        | `'nDPS'`     |
| `$dataCompetencia`    | `dCompet`     | `'dCompet'`  |
| `$tipoEmitente`       | `tpEmit`      | `'tpEmit'`   |
| `$codigoLocalEmissao` | `cLocEmi`     | `'cLocEmi'`  |
| `$versao` (on DPS)    | `@versao`     | `'@versao'`  |
| `$infDps`             | `infDPS`      | `'infDPS'`   |

### 3. **Complete Conversion Example**

**Before:**

```php
$dps = new DpsData(
    versao: '1.00',
    infDps: new InfDpsData(
        id: 'DPS123',
        tipoAmbiente: 2,
        dataEmissao: '2023-01-01',
        versaoAplicativo: '1.0',
        serie: '1',
        numeroDps: '100',
        dataCompetencia: '2023-01-01',
        tipoEmitente: 1,
        codigoLocalEmissao: '3550308',
        // ... other properties with null
    )
);
```

**After:**

```php
$dps = new DpsData([
    '@versao' => '1.00',
    'infDPS' => [
        '@Id' => 'DPS123',
        'tpAmb' => 2,
        'dhEmi' => '2023-01-01',
        'verAplic' => '1.0',
        'serie' => '1',
        'nDPS' => '100',
        'dCompet' => '2023-01-01',
        'tpEmit' => 1,
        'cLocEmi' => '3550308',
        // ... other properties
    ]
]);
```

### 4. **Nested DTOs**

Nested DTOs can also be passed as arrays:

```php
$infDps = new InfDpsData([
    '@Id' => 'DPS123',
    'tpAmb' => 2,
    // ...
    'prest' => [  // prestador property
        'CNPJ' => '12345678000199',
        'IM' => '12345',
        'xNome' => 'Company Name',
        'end' => [  // endereco property
            'endNac.cMun' => '3550308',
            'endNac.CEP' => '01001000',
            'xLgr' => 'Street Name',
            'nro' => '123',
            'xBairro' => 'District',
            // ...
        ],
        // ...
    ],
]);
```

## Finding MapFrom Values

To find the correct `MapFrom` value for any property:

1. Open the DTO file (e.g., `src/Dto/Nfse/InfDpsData.php`)
2. Look for the `#[MapFrom('...')]` attribute above the property
3. Use that exact string as the array key

Example:

```php
// In InfDpsData.php
#[MapFrom('@Id')]
public ?string $id;

// In your test, use:
['@Id' => 'DPS123']
```

## Test Conversion Checklist

For each test file that needs updating:

1. ✅ Replace `new DTO(property: value)` with `new DTO(['mapFromKey' => value])`
2. ✅ Update all property names to their `MapFrom` values
3. ✅ Convert nested DTOs to arrays or DTO instances
4. ✅ Remove any imports of Laravel validation exceptions
5. ✅ Run the test to verify it passes

## Files That Need Updating

Run this command to see which test files need conversion:

```bash
find tests -name "*Test.php" -exec grep -l "new InfDpsData\|new DpsData\|new NfseData" {} \;
```

## Quick Reference: All MapFrom Mappings

### InfDpsData

```php
'@Id' => $id
'tpAmb' => $tipoAmbiente
'dhEmi' => $dataEmissao
'verAplic' => $versaoAplicativo
'serie' => $serie
'nDPS' => $numeroDps
'dCompet' => $dataCompetencia
'tpEmit' => $tipoEmitente
'cLocEmi' => $codigoLocalEmissao
'cMotivoEmisTI' => $motivoEmissaoTomadorIntermediario
'chNFSeRej' => $chaveNfseRejeitada
'subst' => $substituicao
'prest' => $prestador
'toma' => $tomador
'interm' => $intermediario
'serv' => $servico
'valores' => $valores
```

### DpsData

```php
'@versao' => $versao
'infDPS' => $infDps
```

### PrestadorData / TomadorData / IntermediarioData

```php
'CNPJ' => $cnpj
'CPF' => $cpf
'NIF' => $nif
'cNaoNIF' => $codigoNaoNif
'CAEPF' => $caepf
'IM' => $inscricaoMunicipal
'xNome' => $nome
'end' => $endereco
'fone' => $telefone
'email' => $email
'regTrib' => $regimeTributario  // PrestadorData only
```

### EnderecoData

```php
'endNac.cMun' => $codigoMunicipio
'endNac.CEP' => $cep
'xLgr' => $logradouro
'nro' => $numero
'xBairro' => $bairro
'xCpl' => $complemento
'endExt' => $enderecoExterior
```

### RegimeTributarioData

```php
'opSN' => $opcaoSimplesNacional
'regApTribSN' => $regimeApuracaoTributosSn
'regEspTrib' => $regimeEspecialTributacao
```

### ServicoData

```php
'locPrest' => $localPrestacao
'cServ' => $codigoServico
'comExt' => $comercioExterior
'obra' => $obra
'atvEvento' => $atividadeEvento
'infoComplem' => $informacoesComplementares
'idDocTec' => $idDocumentoTecnico
'docRef' => $documentoReferencia
'xInfComp' => $descricaoInformacoesComplementares
```

### ValoresData

```php
'vServPrest' => $valorServicoPrestado
'vDescCondIncond' => $desconto
'vDedRed' => $deducaoReducao
'trib' => $tributacao
```

## Example Test Conversion

See `tests/Unit/Dto/InfDpsDataTest.php` for a complete example of a converted test file.

## Running Tests

After converting, run:

```bash
./vendor/bin/pest --filter=YourTestName
```

Or run all tests:

```bash
./vendor/bin/pest
```

## Need Help?

If you're unsure about a mapping:

1. Check the DTO source file for `#[MapFrom(...)]` attributes
2. Look at existing converted tests for examples
3. The XML element names in `references/*.xml` files match the MapFrom values
