# Spec comportamental — Mira assistida (exemplo fictício)

> Exemplo de referência do kit. A mecânica é **fictícia**; serve para mostrar
> tamanho, granularidade e como o portão aceita uma spec limpa.

## 1. Identificação

- Alvo: Jogo fictício "Exemplo" (cena de treino)
- Versão/build analisada: 0.9.0-demo
- Slug: pan-mechanic
- Data da análise: 2026-10-31
- Autor da análise: equipe de análise (exemplo)
- Ambiente: Windows 11, controle de Xbox, 60 fps estável
- Digest do artefato: sha256 3f1c0a0d5e5b7c9a1d2e3f405162738495a6b7c8d9e0f1a2b3c4d5e6f70819aa
- Handoff: v0.1.0

## 2. Escopo

**Dentro do escopo**

- Cálculo de rotação do personagem em direção ao alvo da mira, por passo de tempo.
- Zona morta angular, velocidade máxima de giro, escolha de sentido no empate.

**Fora do escopo**

- Animações, efeitos visuais, som, arte, modelo, nomes e textos do original.
- Escolha automática de alvo (já tratada em outro comportamento).
- Comportamento com mais de um alvo simultâneo.

**Critério de aceite**

- Todos os casos de `golden.json` passam com tolerância 1e-6.
- Saída sempre no intervalo [0, 360).
- Empate em 180° sempre no sentido positivo.

## 3. Contrato observável

| Campo | Tipo observável | Unidade | Faixa válida | Comportamento fora da faixa |
| --- | --- | --- | --- | --- |
| `current_angle` | número | graus | [0, 360) | normalizado pelo módulo 360 |
| `target_angle` | número | graus | qualquer | normalizado pelo módulo 360 |
| `max_turn_rate` | número | graus/segundo | [0, 720] | valores maiores foram observados como tratados como 720 |
| `dt_ms` | inteiro | milissegundos | [0, 1000] | acima de 1000 o giro satura no alvo |
| `dead_zone_deg` | número | graus | [0, 180] | acima de 180 nunca gira |
| saída | número | graus | [0, 360) | — |

Invariantes observáveis:

- o deslocamento angular por passo nunca excede `max_turn_rate × dt_ms / 1000`;
- se a diferença angular absoluta for menor ou igual a `dead_zone_deg`, a saída é
  igual à entrada normalizada (sem giro);
- a saída nunca "passa" do alvo: ela para nele.

## 4. Comportamento

1. Normalize `current_angle` e `target_angle` para [0, 360) por módulo 360.
2. Calcule a diferença angular no caminho mais curto: subtraia o atual do alvo,
   ajuste para o intervalo (−180, 180]. Quando a diferença for exatamente 180°,
   o sinal é positivo (sentido horário). Quando for exatamente −180°, também é
   tratada como +180°.
3. Se o valor absoluto da diferença for menor ou igual a `dead_zone_deg`, a saída
   é o ângulo atual normalizado.
4. Caso contrário, calcule o passo permitido: `max_turn_rate × dt_ms / 1000`.
5. Desloque o ângulo atual na direção do alvo por `min(passo, |diferença|)`.
6. Normalize o resultado para [0, 360).

Casos de borda:

- diferença de 180° exatos: gira no sentido positivo (ver caso `empate-180`);
- `dt_ms` igual a 0: saída igual à entrada normalizada;
- `max_turn_rate` igual a 0: saída igual à entrada normalizada;
- alvo exatamente igual ao atual: sem giro;
- `dead_zone_deg` igual a 0: qualquer diferença diferente de zero gera giro;
- valores negativos de entrada são normalizados antes de qualquer decisão.

## 5. Constantes e tabelas

| Nome descritivo | Valor | Unidade | Como foi observado | Evidência |
| --- | --- | --- | --- | --- |
| limite superior de velocidade de giro | 720 | graus/segundo | entradas acima disso produziram o mesmo deslocamento de 720 | EV-001 |
| limite superior de passo de tempo | 1000 | milissegundos | passos maiores não alteraram o deslocamento além do alvo | EV-002 |

## 6. Vetores de teste

Os vetores vivem em `golden.json` (`cleanroom-golden/v1`), 7 casos:

- normal: `normal-001`, `normal-002`
- wrap-around: `wrap-horario`, `wrap-anti-horario`
- bordas: `zona-morta`, `empate-180`, `taxa-zero`
- todos derivados de execução controlada do alvo (EV-003).

## 7. Incertezas

| ID | Incerteza | Impacto | Próximo passo para resolver |
| --- | --- | --- | --- |
| U-1 | comportamento com `dt_ms` fracionário não foi observado (a UI só permite inteiros) | baixo | aceitar inteiro no contrato; registrar se aparecer |
| U-2 | não foi verificado se `max_turn_rate` negativo é rejeitado ou normalizado | médio | pedir caso ao time de análise antes de expor o parâmetro |

## 8. Rastreabilidade

| Afirmação/seção | Evidência | Tipo | Data |
| --- | --- | --- | --- |
| Seção 4, passos 2–6 | EV-003 | execução controlada | 2026-10-31 |
| Seção 5, limite 720 | EV-001 | execução controlada | 2026-10-31 |
| Seção 5, limite 1000 ms | EV-002 | execução controlada | 2026-10-31 |

- Bundle de evidências (fora do handoff): sha256 9c2e4b1f7a8d0c3e5f6172839405a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d
- Artefato analisado: sha256 3f1c0a0d5e5b7c9a1d2e3f405162738495a6b7c8d9e0f1a2b3c4d5e6f70819aa

## 9. Declaração de independência

Declaro que esta spec foi escrita a partir de comportamento observável do alvo e
que **não** contém código-fonte, trechos de binário, dumps, assets ou strings
proprietárias do original.

Declaro também que o material entregue se limita a `spec.md`, `golden.json` e
`manifest.json`, e que nenhuma outra informação da sala de análise foi repassada.

- Nome: equipe de análise (exemplo)
- Data: 2026-10-31
- Ambiente de análise: execução controlada em sessão isolada
