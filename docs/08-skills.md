# Skills do kit

O kit já vem com **três skills** próprias, uma para cada papel, além da skill
oficial do REA. Elas são o que transforma "instruções no README" em comportamento
consistente do agente.

## O que existe

| Skill | Onde fica | Carrega quando | Papel |
| --- | --- | --- | --- |
| `clean-room-orchestrator` | `.claude/skills/` (raiz) | você abre o agente na raiz do kit | conduzir o processo: alvo, detecção, portão, handoff, auditoria |
| `clean-room-spec` | `rooms/analysis/.claude/skills/` | você abre o agente em `rooms/analysis` | produzir spec comportamental e vetores |
| `clean-room-impl` | `rooms/impl/.claude/skills/` | você abre o agente em `rooms/impl` | implementar e verificar a partir do handoff |
| `reverse-engineer-anything` | diretório de skills do usuário | `rea setup` / plugin | a skill oficial do REA (roteamento de ferramentas) |

Cada uma tem `SKILL.md` (instruções) e, quando necessário, `references/` com
detalhes carregados sob demanda — exatamente o modelo de progressive disclosure.

## Por que skills separadas por sala

Skill é **instrução operacional**, não só documentação. Se a sala limpa carregasse
a skill de análise, ela aprenderia a usar REA, a procurar evidência e a raciocinar
sobre o binário — que é justamente o que não pode acontecer. Por isso:

- a skill de análise ensina a **observar e documentar**;
- a skill de implementação ensina a **não olhar para trás** e a pedir
  esclarecimento em vez de supor;
- a de orquestração não ensina nenhuma das duas: ela só coordena.

## Como o Claude Code descobre

O Claude Code carrega skills de projeto em `.claude/skills/<nome>/SKILL.md` do
diretório do projeto. Como cada sala é aberta como projeto (`cd rooms/analysis &&
claude`), cada uma vê apenas a sua skill.

O `AGENTS.md` de cada sala repete as regras essenciais. Isso é intencional: se a
skill não carregar (diretório de projeto diferente, versão antiga do cliente), as
regras continuam valendo.

## E o Codex?

O Codex CLI **não consome skills do Claude Code**; ele lê `AGENTS.md` (raiz +
subdiretórios) e o `CLAUDE.md` não tem efeito nele. (Codex carrega skills via
plugin, mas não de `.claude/skills`.) Por isso cada sala tem:

- `AGENTS.md` — regras completas para Codex e outros agentes compatíveis;
- `CLAUDE.md` — resumo + import do `AGENTS.md` para Claude Code;
- `.claude/skills/` — detalhamento progressivo para Claude Code.

Se você usa outro agente que leia `SKILL.md` no formato Agent Skills, pode
apontar para as mesmas pastas — não há duplicação de conteúdo. A skill oficial do REA também pode ser instalada em
`~/.agents/skills` com `npx skills add morluto/rea --skill reverse-engineer-anything`.

## Como editar com segurança

1. Regra de negócio do processo → `AGENTS.md` da sala (vale para todos os agentes).
2. Procedimento detalhado, tabelas e exemplos → `references/` da skill.
3. Nunca coloque segredo, caminho absoluto de máquina ou dado de alvo nas skills.
4. Depois de editar, rode:

```bash
npm test                 # valida frontmatter, nome e referências
./scripts/doctor.sh      # valida instalação, hooks e skills no seu ambiente
```

## Criar uma skill nova

```
rooms/<sala>/.claude/skills/<nome>/
  SKILL.md            # frontmatter: name, description, metadata.version
  references/*.md     # opcional, carregado sob demanda
```

Regras de frontmatter:

```yaml
---
name: nome-da-skill          # igual ao nome da pasta, kebab-case
description: o que faz e QUANDO usar (o modelo decide pelo description)
metadata:
  version: "1"
---
```

O `description` é o que faz a skill ser acionada: diga o gatilho ("use quando...")
e o limite ("não use para...").

## Limites

- Skill não é sandbox. Quem impede a sala limpa de ver o alvo são os hooks e,
  de verdade, o isolamento de SO/container (`docs/00-metodo-clean-room.md`).
- Skill não substitui revisão humana: o portão pega código e dumps, não pega
  "explicação internalizada" do funcionamento do original.
- Skill do REA descreve ferramentas; a versão do servidor manda. Se uma
  ferramenta não existir, siga o `rea doctor` e o esquema real do MCP.
