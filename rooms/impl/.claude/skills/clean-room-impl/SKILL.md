---
name: clean-room-impl
description: Implemente uma versão independente e testada de um comportamento de jogo ou app a partir de uma spec de clean room e vetores golden, sem acessar o original, o REA ou a análise. Use quando estiver na sala limpa (rooms/impl) com um handoff em targets/<slug>/handoff/v*.
metadata:
  version: "1"
---

# Implementação em sala limpa

Você está na **sala limpa**. Sua única fonte sobre o alvo é o handoff:
`spec.md`, `golden.json`, `manifest.json`. O resto é sua engenharia.

## Preparação

1. Leia `manifest.json` (versão, hashes, declaração de independência).
2. Leia `spec.md` inteiro, duas vezes: contrato, comportamento, bordas, incertezas.
3. Leia `golden.json` e transforme **cada caso em um teste** com o mesmo `id`.
4. Confirme o isolamento: `./scripts/verify-isolation.sh <slug>` (na raiz do kit).
5. Escolha a stack do projeto por mérito técnico — não porque "o original usa X".

## Ciclo

```
teste que falha → implementação mínima → teste passa → próxima borda
```

- Comece pelos vetores normais, depois bordas, depois erros.
- Respeite `tolerance`; não ajuste o teste para caber na implementação.
- Não introduza dependência do original em nenhum momento (nem build, nem runtime).
- Comente o **porquê** de cada decisão, citando a seção da spec (ex.: `spec §4.2`).

## Limites

Não faça, mesmo que pareça útil:

- instalar/rodar REA, Ghidra, Hopper, IDA, JADX, Frida;
- ler `targets/<slug>/analysis/` ou qualquer bundle de evidência;
- baixar o app/jogo, assets, wiki com detalhes internos ou código "equivalente";
- copiar strings, nomes, ícones, sons, mapas, layout de UI ou estrutura de arquivos
  do original;
- "lembrar" como o original funciona e implementar por memória.

Se o guard bloquear, **pare e peça revisão humana**. Não tente contornar.

## Ambiguidade

Spec omissa ou contraditória → **pedido de esclarecimento** por escrito
(`references/ambiguity-protocol.md`) e siga nas partes não afetadas.
Nunca invente comportamento; nunca pergunte "como o original faz isso".
Pergunte "qual é a saída esperada para esta entrada?".

## Verificação

- Todos os casos golden passam, com tolerância.
- Bordas e erros descritos têm teste próprio.
- Nenhuma constante sem justificativa na spec.
- Nenhum asset/string copiado.
- `PROVENANCE.md` liga seção da spec → arquivo/teste (molde em `templates/PROVENANCE.md`).
- `DELIVERY.md` com resultado, decisões e pendências (molde em `templates/DELIVERY.md`).

Detalhes: `references/verification.md`.

## Definição de pronto

- [ ] 100% dos vetores golden verdes.
- [ ] Bordas e erros cobertos.
- [ ] `PROVENANCE.md` completo.
- [ ] Nenhum acesso proibido (confira o histórico do projeto).
- [ ] Relatório de entrega escrito.
