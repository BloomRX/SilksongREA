# Qualidade da spec

Uma boa spec permite que alguém que **nunca viu o original** implemente um
equivalente e prove que é equivalente.

## Teste de suficiência

Responda mentalmente, só com a spec:

1. Quais são as entradas, tipos, unidades e faixas válidas?
2. Qual é a saída para cada combinação relevante, incluindo bordas?
3. O que acontece com entrada inválida, empate, zero, negativo, valor extremo?
4. Existem estados? Como se entra e sai deles?
5. Como sei que acertei sem ver o original? (vetores!)
6. O que é explicitamente indefinido?

Se alguma resposta for "está no código", a spec está incompleta.

## Redação: faça e não faça

**Faça**

- "a saída é o ângulo atual deslocado no sentido do alvo por no máximo
  `max_turn_rate × dt`, com o módulo normalizado para o intervalo [0, 360)."
- "quando a diferença é exatamente 180°, a rotação é no sentido positivo"
  (com caso em `golden.json`).
- "entrada negativa é rejeitada com a mensagem visível 'valor inválido'".

**Não faça**

- "igual ao `CalculateAim()` do original".
- "usa interpolação Lerp com fator 0.2" (a menos que isso seja observável e o
  valor 0.2 tenha sido medido — e mesmo assim descreva o efeito, não o nome).
- "ver função no endereço 0x4A2B10".
- tabelas com nomes internos de variáveis do binário.

## Níveis de confiança

Use no texto ou numa coluna:

- **alta** — observado e reproduzido em mais de uma execução/ambiente;
- **média** — observado uma vez, consistente;
- **baixa** — inferido de documentação pública ou de comportamento indireto.

Confiança baixa em comportamento central = obrigatório gerar mais vetores.

## Bordas obrigatórias

Pense sempre em: empate, zero, negativo, overflow, valor no limite da faixa,
entrada vazia, unidade errada, ordem de operações, repetição/estado acumulado,
diferença entre plataformas/versões.

## Exemplo mínimo (ficcional)

Ver `examples/pan-mechanic/` neste repo: uma spec de 1 página, 7 vetores, e uma
implementação independente que passa neles — sem nenhuma linha do original.
Use como referência de tamanho e granularidade.
