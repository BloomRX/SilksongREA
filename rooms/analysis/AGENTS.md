# Sala de análise (sala "suja")

Você está do lado que **pode ver o original**. Seu produto não é código: é
**comportamento documentado** — `spec.md` + `golden.json` — e a evidência que
sustenta cada afirmação.

## Regra de ouro

> Se aparecer código, dump ou asset no documento, o handoff é bloqueado.
> Descreva **o que o sistema faz**, nunca **como o original escreveu isso**.

## Pode / não pode

| Pode | Não pode |
| --- | --- |
| Ler o alvo em `targets/<slug>/analysis/artifacts/` | Escrever código de produto nesta sala (o guard bloqueia) |
| Usar REA (MCP/CLI), Ghidra, Hopper, JADX etc. | Entrar em `rooms/impl` |
| Rodar o alvo e registrar entradas/saídas | Copiar arte, áudio, textos, mapas, personagens ou marcas |
| Medir tempos, contagens, limites, erros visíveis | Copiar strings proprietárias para a spec |
| Exportar bundles de evidência para `analysis/evidence/` | Colocar evidência bruta no handoff |
| Escrever notas internas em `analysis/spec/notes/` | Escrever pseudocódigo derivado de decompilação |
| Escrever harness de observação em `analysis/tools/` | Escrever código de produto em qualquer lugar |

## Fluxo

1. **Entenda o alvo.** Leia `targets/<slug>/README.md` e confirme a pergunta de
   engenharia e o critério de sucesso.
2. **Confirme as ferramentas.** Se as ferramentas do REA não aparecerem, rode
   `rea doctor --client <claude_code|codex>` e siga `references/rea-routing.md`.
   Não reinstale nada sem diagnosticar.
3. **Roteie por tipo de alvo** e abra a sessão (ver `references/rea-routing.md`):
   nativo, Unity/IL2CPP, Godot, .NET, Electron/JS, Android, Apple, web, firmware.
4. **Investigue em ondas**: reconhecimento → hipótese → teste observável →
   conclusão com evidência. Uma pergunta por vez, respondida por observação.
5. **Registre no formato da spec**: cada afirmação com evidência (`EV-...`) e
   nível de confiança; o que não deu para ver vai para a seção 7 (Incertezas).
6. **Monte os vetores**: pares entrada/saída reproduzíveis em `golden.json`,
   incluindo bordas e erros. Prefira casos que você **executou**.
7. **Passe o portão**:
   ```bash
   node scripts/check-spec.mjs targets/<slug>/analysis/spec/spec.md --strict
   ```
   Corrija bloqueios; avisos você avalia e resolve.
8. **Entregue**: quem estiver operando roda `./scripts/handoff.sh <slug> <versão>`.
   Handoffs são imutáveis — correção gera nova versão.

## Conversa com a sala limpa

Pedidos de esclarecimento chegam em `targets/<slug>/analysis/requests/`.
Responda **na spec** e **com novos vetores**; nunca com código, trecho de binário
ou explicação de implementação interna. Se o comportamento é indefinido, escreva
isso explicitamente e diga como a implementação deve tratar.

## Skills disponíveis

- `clean-room-spec` — procedimento completo, roteamento de alvos e qualidade de spec.
- `reverse-engineer-anything` — a skill oficial do REA (instalada pelo `rea setup`).

Detalhes do processo: `docs/02-fluxo-passo-a-passo.md`.
