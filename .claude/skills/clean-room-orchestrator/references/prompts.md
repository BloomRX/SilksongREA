# Prompts prontos

Ajuste `<slug>`, `<versão>` e `<comportamento>`. Todos assumem que o agente foi
aberto dentro da sala correspondente.

## Sala de análise

```text
Leia AGENTS.md e a skill clean-room-spec.

Alvo: ../../targets/<slug>/analysis/artifacts (versão <versão>).
Pergunta de engenharia: como o sistema decide <comportamento>?

Contexto da detecção:
<cole aqui a saída de ./scripts/detect-target.sh <slug>>

Faça:
1. reconhecimento em ../../targets/<slug>/analysis/spec/notes/recon.md;
2. investigação dirigida com REA, uma hipótese por vez, com evidência;
3. exporte o bundle de evidência para ../../targets/<slug>/analysis/evidence/;
4. preencha ../../targets/<slug>/analysis/spec/spec.md e golden.json;
5. rode node ../../scripts/check-spec.mjs ../../targets/<slug>/analysis/spec/spec.md --strict.

Regras: nada de código, trechos de binário, strings proprietárias ou assets no
documento; o que não foi observado vai para a seção 7 (Incertezas).
```

## Sala de implementação

```text
Leia AGENTS.md e a skill clean-room-impl.

Implemente ../../targets/<slug>/handoff/v<versão> em <linguagem/framework>.
Comece transformando cada caso de golden.json em teste com o mesmo id.
Respeite as tolerâncias e cubra as bordas descritas na spec.
Se algo for ambíguo, escreva um pedido de esclarecimento e siga no resto.
Mantenha PROVENANCE.md (seção da spec → arquivo/teste) e escreva DELIVERY.md.
```

## Pedido de esclarecimento (sala limpa → análise)

```text
Crie requests/NNN-<tema>.md respondendo:
1. qual é a pergunta, em uma frase;
2. qual seção da spec e quais casos do golden são afetados;
3. qual saída esperada você precisa conhecer;
4. que formato de resposta resolve (novo vetor e/ou texto na spec).
Não peça código nem detalhe de implementação do original.
```

## Resposta da análise

```text
Leia o pedido em ../../targets/<slug>/analysis/requests/NNN-<tema>.md.
Responda atualizando a spec (seção afetada) e adicionando vetores ao golden.json.
Não inclua código, trechos de binário ou nomes internos. Se o comportamento for
indefinido, escreva isso explicitamente e o que a implementação deve fazer.
Depois rode o portão com --strict.
```

## Revisão humana da spec (operador)

```text
Avalie a spec como alguém que nunca viu o alvo:
- os testes podem ser escritos só com golden.json?
- bordas, empates, zero, negativo e erros estão descritos?
- cada número tem origem observável?
- as incertezas estão explícitas e não disfarçadas de certeza?
- a declaração de independência está assinada?
Liste o que falta, sem preencher você mesmo.
```

## Auditoria final

```text
Na raiz do kit, rode ./scripts/verify-isolation.sh <slug> e confira:
- todos os vetores passam no projeto da sala limpa;
- PROVENANCE.md e DELIVERY.md existem e estão completos;
- nenhum arquivo do original, evidência ou asset está versionado;
- o histórico da sala limpa não menciona REA, o alvo ou a análise.
Resuma o resultado e as pendências.
```
