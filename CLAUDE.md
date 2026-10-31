@AGENTS.md

# Atalho para Claude Code

Você está na raiz do kit. **Não analise alvo nem escreva código de produto aqui.**

- Para investigar um alvo com REA: `cd rooms/analysis && claude`
- Para implementar a partir da spec: `cd rooms/impl && claude`

Cada sala tem seu próprio `CLAUDE.md` + `AGENTS.md` + skill:

| Sala | Skill | Instruções |
| --- | --- | --- |
| `rooms/analysis` | `clean-room-spec` | `rooms/analysis/AGENTS.md` |
| `rooms/impl` | `clean-room-impl` | `rooms/impl/AGENTS.md` |

Regra que não muda: a spec (`spec.md` + `golden.json`) é o único canal entre as
salas. Sem código, sem evidência bruta e sem assets atravessando.
