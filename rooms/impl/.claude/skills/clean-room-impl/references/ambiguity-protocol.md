# Protocolo de ambiguidade

Toda pergunta da sala limpa deve poder ser respondida **sem revelar a
implementação original**.

## Formato do pedido

Crie `requests/NNN-<tema>.md` no seu projeto (fora do handoff, que é somente
leitura):

```markdown
# Pedido de esclarecimento 001

## 1. Pergunta
No empate exato de 180°, a saída deveria ser +180° ou −180°?

## 2. Contexto da spec
- Handoff: v0.1.0
- Seção: 4 (passo 2), 7 (U-1)
- Casos afetados: nenhum golden cobre o empate

## 3. O que preciso saber
- Sinal da rotação no empate
- Se o comportamento muda com dt fracionário

## 4. Formato da resposta
- [x] Novo vetor golden cobrindo o empate
- [x] Atualização textual da seção 4
```

## Regras

- Pergunte por **entrada e saída esperada**, não por "como o original faz".
- Nunca peça código, pseudocódigo, trecho de binário ou nome de função.
- Uma pergunta por pedido; numere e mantenha histórico.
- Enquanto não houver resposta, isole a parte afetada (feature flag, TODO com
  referência ao pedido) e siga no resto. Não invente.
- Se a resposta não vier, entregue com a limitação declarada.

## Como o outro lado responde

A sala de análise atualiza a spec e adiciona vetores, e o operador gera um novo
handoff (`v0.1.1`). Você então:

1. compara os manifestos;
2. roda o diff dos vetores;
3. atualiza testes e implementação;
4. fecha o pedido no relatório.
