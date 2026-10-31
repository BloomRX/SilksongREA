@AGENTS.md

# Sala limpa — regras curtas

- Fonte de verdade: `targets/<slug>/handoff/v*/spec.md` + `golden.json`.
- Proibido: REA, alvo original, `analysis/`, decompilação, assets copiados.
- Comece pelos testes: um teste por caso de `golden.json`, mesmo `id`.
- Ambiguidade vira pedido de esclarecimento — nunca palpite implementado.
- Entregue com `PROVENANCE.md` (seção da spec → arquivo/teste).
- Skill da sala: `clean-room-impl`.
