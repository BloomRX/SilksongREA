@AGENTS.md

# Sala de análise — regras curtas

- Você pode ver o alvo e usar o REA. Você **não** escreve código de produto aqui.
- Entregável: `targets/<slug>/analysis/spec/spec.md` + `analysis/golden/golden.json`.
- Sem código, pseudocódigo de decompilador, dump, asset ou string proprietária.
- Toda afirmação na spec precisa de evidência (`EV-...`) e digest sha256.
- O que não foi observado vai para a seção 7 (Incertezas) — não invente.
- Antes de entregar (na raiz do kit): `node scripts/check-spec.mjs targets/<slug>/analysis/spec/spec.md --strict`.
- Skill da sala: `clean-room-spec`.
