# 11 · Anotar ou implementar direto?

A dúvida é legítima: documentar tudo antes pode parecer burocracia; implementar
direto pode parecer economia. A regra que separa os dois casos não é "jogo vs.
app", é **de onde veio a informação**.

## A regra de ouro

| Você obteve o comportamento… | Pode implementar direto? | O que registrar mesmo assim |
| --- | --- | --- |
| jogando, medindo tempo, testando entradas/saídas | **sim** | constantes + 5–20 vetores de teste |
| lendo documentação pública, protocolo, formato | **sim** | contrato (campos, erros, limites) |
| lendo assembly, binário, decompilação, dump | **não** | spec antes; implementação em outra sessão |
| reutilizando código, nomes ou strings do original | **nunca** | — |

O motivo é prático, não cerimonial: quem lê o código original e escreve o novo na
mesma sessão produz material derivado — e depois não consegue provar
independência. Quem só observou comportamento não tem esse problema.

## Jogos: spec mínima por mecânica

Para uma mecânica isolada, "anotar" não é um documento de 30 páginas. É isto:

```markdown
# Movimento horizontal
Estados: parado, andando, acelerando, virando.
Entradas: direção (-1, 0, +1) por frame; dt fixo de 1/60 s.
Regra: v += accel*dt (limitado a vmax); ao soltar, v -= decel*dt até 0.
Constantes: vmax=6.0 u/s; accel=40 u/s²; decel=60 u/s²; troca de direção
  aplica decel antes de acelerar no sentido oposto.
Bordas: colisão zera v no eixo; entrada oposta durante o movimento inverte.
Vetores: 6 casos em golden.json (parado→anda, anda→máx, solta, vira, parede).
Incertezas: valor de vmax em terreno inclinado não medido.
```

Uma página + vetores. Isso responde "o que implementar", "com que números" e
"como saber que acertei". Sem ela, você re-mede a cada sessão e não consegue
testar equivalência depois.

**Spec completa** (9 seções, evidência por afirmação, auditoria) vale a pena
quando: o comportamento é composto (movimento + colisão + dano), outra pessoa vai
implementar, o resultado é comercial, ou você quer reusar a spec entre versões do
jogo.

## Apps: o contrato vem primeiro

Em apps, a parte valiosa quase sempre é **interoperabilidade**, e aí a spec não é
burocracia — é o produto:

- formato de arquivo, banco, protocolo de rede, API, plugin, CLI;
- estados e transições de um fluxo (login, sincronização, importação);
- erros, limites, timeouts, versionamento.

Implemente direto quando o comportamento é visual e você vai iterar na tela
(UI, atalhos, layout): uma lista de critérios de aceitação + testes de fluxo
basta. Mas nunca reaproveite strings, ícones, textos, CSS ou bundle minificado —
descreva o efeito, implemente do zero.

## O que dá retrabalho de verdade

| Atalho tentador | Custo depois |
| --- | --- |
| implementar sem anotar as constantes | re-medir tudo na próxima sessão; números divergentes |
| ler o assembly e "só dar uma olhada" antes de codar | risco de material derivado; auditoria impossível |
| escrever a spec depois do código | spec vira justificativa, não contrato; não serve para handoff |
| copiar nomes internos para "facilitar" | contaminação: `sub_`, `FUN_`, nomes de classes do original |
| pular os vetores | não há como provar equivalência; bug vira discussão |

## Como isso cai no kit

1. **Sala de análise** (`rooms/analysis`): observa, mede, escreve a spec e os
   vetores. Uma mecânica por vez.
2. **Portão**: `node scripts/check-spec.mjs <spec> --strict` — bloqueia código,
   nomes derivados e afirmação sem evidência.
3. **Handoff**: `./scripts/handoff.sh <slug> <versão>` — sela spec + vetores.
4. **Sala limpa** (`rooms/impl`): implementa **só** o handoff, na engine/stack que
   você escolher, transformando cada vetor em teste.
5. **Verificação**: `./scripts/verify-isolation.sh <slug>` + testes diferenciais.

Para o caso do Silksong: uma spec de uma página sobre movimento horizontal, 6
vetores, handoff e implementação em qualquer engine (Unity, Godot, um pequeno
projeto em C# ou JS). O motor é irrelevante para a spec — os vetores são
entrada/saída, não código.

Se você só vai observar (sem REA), pode encurtar: meça no jogo, escreva a spec
mínima e vá direto para a sala limpa. O que não pode é pular o registro.
