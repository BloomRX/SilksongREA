# Spec comportamental — {{NAME}}

> Documento de clean room. Descreva **comportamento observável**, não implementação.
> Nada de código, trechos de binário, dumps ou assets.
> Quem implementa só pode ver o que está aqui e em `golden.json`.

## 1. Identificação

- Alvo: {{NAME}}
- Versão/build analisada: {{VERSION}}
- Slug: {{SLUG}}
- Data da análise: {{DATE}}
- Autor da análise: (preencher)
- Ambiente: (sistema, engine/runtime, arquitetura)
- Digest do artefato: sha256 (preencher; ver `analysis/artifacts.sha256`)
- Handoff: v (preencher)

## 2. Escopo

**Dentro do escopo** — o que será reimplementado:

- (preencher: ex. "cálculo de mira assistida ao usar o controle X")

**Fora do escopo** — o que não será reimplementado:

- arte, áudio, modelos, textos, mapas, personagens, nomes e marcas do original;
- (preencher outros limites)

**Critério de aceite** — como saberemos que ficou equivalente:

- todos os casos de `golden.json` passam;
- (preencher critérios adicionais observáveis, sem citar código do original)

## 3. Contrato observável

Descreva a fronteira do comportamento como um contrato: entradas, saídas, unidades,
faixas válidas, erros visíveis ao usuário e efeitos colaterais observáveis.

| Campo | Tipo observável | Unidade | Faixa válida | Comportamento fora da faixa |
| --- | --- | --- | --- | --- |
| (preencher) | | | | |

Invariantes observáveis:

- (preencher: ex. "a saída está sempre em [0, 360)")

## 4. Comportamento

Passo a passo em linguagem natural, na ordem em que acontece. Sem blocos de código.
Descreva decisões, condições de parada, estados e transições.

1. (preencher)
2. (preencher)

Estados e transições (se houver):

| Estado atual | Evento/condição | Próximo estado | Efeito observável |
| --- | --- | --- | --- |
| | | | |

Casos de borda:

- (preencher: empates, divisão por zero, valores negativos, overflow visível, etc.)
- Se algo não pôde ser observado, registre na seção 7 em vez de supor.

## 5. Constantes e tabelas

Somente valores que você conseguiu observar no comportamento externo, com o método
de observação. Constantes internas inferidas não entram aqui.

| Nome descritivo | Valor | Unidade | Como foi observado | Evidência |
| --- | --- | --- | --- | --- |
| | | | | EV-000 |

## 6. Vetores de teste

Os vetores vivem em `golden.json` (formato `cleanroom-golden/v1`). Cada caso tem
`id`, `input`, `expected` e, quando fizer sentido, `tolerance`.

- Quantidade de casos: (preencher)
- Cobertura pretendida: (normal, bordas, erros, empates)
- Casos derivados de execução do original: (quais IDs)
- Casos derivados apenas de leitura de comportamento documentado: (quais IDs)

## 7. Incertezas

Liste explicitamente o que **não** foi observado, o que é ambíguo e o que pode
mudar entre versões. Implementação não deve preencher lacunas por conta própria.

| ID | Incerteza | Impacto | Próximo passo para resolver |
| --- | --- | --- | --- |
| U-1 | | | |

## 8. Rastreabilidade

Cada afirmação relevante acima deve apontar para uma observação. Referencie as
evidências por ID (EV-...) e pelos digests sha256 do alvo e do bundle exportado.

| Afirmação/seção | Evidência | Tipo (execução, captura, documento) | Data |
| --- | --- | --- | --- |
| | EV-000 | | |

- Bundle de evidências (fora do handoff): sha256 (preencher)
- Artefato analisado: sha256 (preencher)

## 9. Declaração de independência

Declaro que esta spec foi escrita a partir de comportamento observável do alvo e
que **não** contém código-fonte, trechos de binário, dumps, assets ou strings
proprietárias do original.

Declaro também que o material entregue se limita a `spec.md`, `golden.json` e
`manifest.json`, e que nenhuma outra informação da sala de análise foi repassada.

- Nome: (preencher)
- Data: {{DATE}}
- Ambiente de análise: (preencher)
