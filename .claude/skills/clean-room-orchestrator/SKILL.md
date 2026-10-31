---
name: clean-room-orchestrator
description: Opere o kit de clean room a partir da raiz - criar alvo, detectar o tipo (Unity, Godot, Electron, .NET, Android, nativo, web...), rotear para a sala de análise, revisar a spec, rodar o portão, selar o handoff e auditar o isolamento. Use quando o usuário estiver orquestrando o processo na raiz do kit, não analisando nem implementando.
metadata:
  version: "1"
---

# Orquestrador de clean room

Você está na **raiz do kit**. Seu trabalho é conduzir o processo, não analisar o
alvo nem escrever a implementação. Quem faz isso são as salas.

## Pré-requisitos

- `./scripts/bootstrap.sh` já rodou (REA registrado, guards ativos).
- Se `rea` não existir, oriente a instalação (`docs/01-instalacao-rea.md`); não
  invente configuração de MCP.

## Regras

1. **Nunca** leia o alvo para produzir spec aqui, nem escreva código de produto.
   Encaminhe para `rooms/analysis` ou `rooms/impl`.
2. **Nunca** copie nada de `targets/<slug>/analysis/` para a pasta da
   implementação. O único transporte é `handoff/vX.Y.Z/`.
3. **Nunca** edite um handoff selado. Correção = nova versão.
4. Toda decisão de escopo é humana: confirme a pergunta de engenharia e o
   direito de análise antes de começar.

## Fluxo

### 1. Entrada

Pergunte e registre na ficha do alvo:

- o que exatamente se quer reimplementar (uma mecânica, um formato, um fluxo);
- qual build (versão/hash) será analisado;
- por que o usuário tem direito de analisar aquilo;
- o que **não** será copiado (arte, áudio, textos, mapas, marcas).

Se o pedido for "clonar o produto inteiro", reduza o escopo.

### 2. Criar o alvo

```bash
./scripts/new-target.sh <slug> --name "Nome" --version "1.2.3"
./scripts/hash-artifacts.sh <slug>
```

### 3. Detectar o tipo

```bash
./scripts/detect-target.sh <slug>
```

Use a saída para escolher o prompt inicial e as famílias de ferramentas:

| Detecção | Primeiro passo no REA | Provedor |
| --- | --- | --- |
| Unity IL2CPP | `inspect_il2cpp_metadata` + binário | sim |
| Unity Mono | `inspect_managed_artifact` | não |
| UnityFS / Godot PCK | `inspect_artifact` | não |
| Electron/ASAR | `analyze_javascript_application` | não |
| .NET | `inspect_managed_artifact` | não |
| Android | `inspect_android_package` | opcional (JADX) |
| Nativo | `open_binary` | sim |
| Web/WASM | browser / artefato | não |

### 4. Encaminhar para a análise

Dê ao usuário o comando e o prompt (modelos em `references/prompts.md`):

```bash
cd rooms/analysis && claude     # ou: codex
```

Critérios de saída da análise: spec com 9 seções, vetores com bordas, evidência,
incertezas explícitas.

### 5. Revisar antes do portão

Leia a spec como implementador cego:

- dá para escrever os testes só com `golden.json`?
- bordas e erros estão descritos?
- todo número tem origem observável?
- a declaração de independência está assinada?

Se faltar, devolve para a análise — não "complete" a spec você mesmo.

### 6. Portão e handoff

```bash
node scripts/check-spec.mjs targets/<slug>/analysis/spec/spec.md --strict
./scripts/handoff.sh <slug> <versão>
./scripts/verify-isolation.sh <slug>
```

### 7. Encaminhar para a implementação

```bash
cd rooms/impl && claude         # ou: codex (de preferência outro agente)
```

### 8. Ciclo de correção

Pedido de esclarecimento → nova spec (`v0.1.1`) → novo handoff → diff de
manifestos → testes novos. Nunca edite o handoff anterior.

### 9. Encerramento

Exija da sala limpa: `PROVENANCE.md`, `DELIVERY.md`, testes verdes, nenhum
material do original. Rode `./scripts/verify-isolation.sh` e registre o resultado
no `analysis/audit/log.jsonl`.

## Diagnóstico rápido

| Sintoma | Ação |
| --- | --- |
| `rea` ausente | `docs/01-instalacao-rea.md`; não improvise registro |
| ferramentas MCP não aparecem | reiniciar cliente; `rea doctor --client <id>` |
| portão bloqueia | corrija a spec na sala de análise |
| handoff existe | nova versão, nunca `--force` sem registrar |
| verify falha | siga `docs/07-solucao-de-problemas.md` |

## Referências

- `references/prompts.md` — prompts prontos para cada sala e para o ciclo de
  esclarecimento.
