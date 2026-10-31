# SilksongREA — clean room com REA para qualquer app ou jogo

Monte um **clean room** (sala limpa) para reimplementar comportamentos de jogos e
apps com agentes — Claude Code e Codex CLI — usando o
[REA (Reverse Engineering Agent)](https://github.com/morluto/rea) só do lado de
quem analisa o original.

O kit é **agnóstico ao alvo**: detecta Unity (Mono/IL2CPP), UnityFS, Godot,
Electron/ASAR, .NET, Android, Apple, binário nativo, WASM, ROMs, SQLite, capturas
de rede e firmware. Silksong é só um caso de teste; o processo é o mesmo para
qualquer aplicativo ou jogo que você tenha o direito de analisar.

> **Escopo.** Este kit é para interoperabilidade, preservação, pesquisa e
> aprendizado com software que você possui ou está autorizado a examinar. Ele
> **não** autoriza copiar arte, áudio, personagens, mapas, nomes ou marcas, nem
> contornar DRM/anti-cheat. Leia `docs/05-limites-legais-e-politica.md`. Não é
> aconselhamento jurídico.

---

## A ideia em 30 segundos

```
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ SALA DE ANÁLISE (suja)       │        │ SALA LIMPA (implementação)   │
│                              │        │                              │
│  você + REA + cópia do alvo  │  spec  │  outro agente, sessão nova   │
│  Ghidra / Hopper / JADX      │ ─────► │  sem REA, sem alvo,          │
│                              │  +     │  sem evidência               │
│  produz: comportamento       │ goldens│  produz: código + testes     │
│  observável + evidência      │        │  independentes               │
└──────────────────────────────┘        └──────────────────────────────┘
                    │                                   ▲
                    └──── portão automático ────────────┘
                        (scripts/check-spec.mjs)
                        bloqueia código, dump, asset,
                        símbolo de decompilador
```

A única coisa que atravessa é **`spec.md` + `golden.json` + `manifest.json`**,
selados em somente-leitura, com hashes e declaração de independência. O portão
barra código, trechos de binário, dumps, assets e vocabulário de engenharia
reversa. O hook do agente impede a sala limpa de tocar no REA, no alvo ou na
análise.

## Funciona com qualquer alvo

```bash
./scripts/detect-target.sh meu-alvo
```

O detector lê nomes, extensões e alguns bytes de cabeçalho (sem executar nada) e
recomenda a rota, o provedor e as famílias de ferramentas do MCP:

| Detecta | Rota recomendada | Provedor nativo |
| --- | --- | --- |
| Unity IL2CPP (`GameAssembly` + `global-metadata.dat`) | `inspect_il2cpp_metadata` → binário | sim |
| Unity Mono (`Assembly-CSharp.dll`) | `inspect_managed_artifact` | não |
| UnityFS AssetBundle (`.bundle`, `.assets`) | `inspect_artifact` | não |
| Godot PCK (`.pck`) | `inspect_artifact` | não |
| Electron/ASAR | `analyze_javascript_application` | não |
| .NET (PE com cabeçalho CLI) | `inspect_managed_artifact` | não |
| Android (`.apk`, `.aab`) | `inspect_android_package` | opcional (JADX) |
| Apple (`.app`, `.ipa`, `Info.plist`) | `open_bundle_resources` | opcional |
| Nativo (ELF/PE/Mach-O) | `open_binary` | sim |
| WASM, ROMs, SQLite, PCAP, firmware | rota específica | conforme o caso |
| Web (`index.html` + JS, `.har`) | observação de navegador | não |

## O que dá e o que não dá para reimplementar

| Coisa | Clean room ajuda? | Observação |
| --- | --- | --- |
| Mecânica, regra de jogo, algoritmo, cálculo | ✅ | ideias e métodos não são protegidos; a **expressão** é |
| Formato de arquivo, protocolo, interoperabilidade | ✅ | documente o formato e implemente de forma independente |
| Comportamento de UI, fluxo, atalhos | ✅ | descreva o comportamento, não copie layout/ícones |
| Código-fonte do original | ⚠️ | não pode ser copiado; clean room reduz o risco de contaminação |
| Arte, modelos, áudio, textos, mapas, fases | ❌ | são expressão protegida — crie material original |
| Personagens, nomes, logotipos, marcas | ❌ | viola direitos autorais/marcários |
| DRM, anti-cheat, verificação de licença | ❌ | fora de escopo, sempre |

## Requisitos

- **Node.js** 22.x (>= 22.23.4), 24.x (>= 24.22.1) ou >= 26.12.1 — exigência do REA.
  O kit inclui `.nvmrc` com 24: `nvm use` resolve.
- **Claude Code** e/ou **Codex CLI** (os apps de chat na web não rodam MCP local;
  veja a FAQ no fim).
- Um provedor para binários nativos: **Ghidra** (grátis, recomendado),
  **Hopper**, **IDA** ou **Kuna**. Para JavaScript/Electron, .NET, Godot PCK,
  UnityFS e containers, não precisa de engine nativa.

## Instalação rápida (macOS/Linux)

```bash
git clone <este-repo> cleanroom-rea && cd cleanroom-rea

./scripts/bootstrap.sh
#   ou: ./scripts/bootstrap.sh --clients claude_code,codex
#   ou: ./scripts/bootstrap.sh --claude
#   ou: ./scripts/bootstrap.sh --codex
```

O bootstrap:

1. confere a versão do Node;
2. instala o `rea-agents` globalmente (caminho durável);
3. mostra o plano de setup de cada cliente (`--dry-run`) e pede aprovação;
4. registra o MCP do REA e instala a skill oficial;
5. cria as pastas de trabalho e instala os guards das salas;
6. roda `rea doctor` e o verificador de isolamento.

**Windows:** use WSL2 (recomendado) e rode os scripts dentro dele. Para
PowerShell nativo, veja `docs/01-instalacao-rea.md`.

## Uso em 7 passos

```bash
# 1. crie um alvo (qualquer jogo ou app)
./scripts/new-target.sh meu-jogo --name "Meu Jogo" --version "1.0.0"

# 2. coloque sua cópia do alvo e registre os hashes
cp -R /caminho/do/alvo targets/meu-jogo/analysis/artifacts/
./scripts/hash-artifacts.sh meu-jogo

# 3. descubra o tipo e a rota
./scripts/detect-target.sh meu-jogo

# 4. sala de análise: investigue e escreva a spec
cd rooms/analysis && claude      # ou: codex

# 5. portão + handoff selado
cd ../..
node scripts/check-spec.mjs targets/meu-jogo/analysis/spec/spec.md --strict
./scripts/handoff.sh meu-jogo 0.1.0

# 6. sala limpa: implemente só com a spec (sessão nova, de preferência outro agente)
cd rooms/impl && claude          # ou: codex

# 7. audite
cd ../.. && ./scripts/verify-isolation.sh meu-jogo
```

### Prompt para a sala de análise

```text
Leia AGENTS.md e a skill clean-room-spec.
Alvo: ../../targets/meu-jogo/analysis/artifacts (versão 1.0.0).
Quero entender <comportamento específico>. Produza a spec em
../../targets/meu-jogo/analysis/spec/spec.md e os vetores em golden.json.
Registre evidência e incertezas. Não escreva código de produto.
```

### Prompt para a sala limpa

```text
Leia AGENTS.md e a skill clean-room-impl.
Implemente ../../targets/meu-jogo/handoff/v0.1.0 com <stack>.
Comece transformando cada caso de golden.json em teste.
Se a spec for ambígua, crie um pedido de esclarecimento; não invente.
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `./scripts/bootstrap.sh` | instala/atualiza REA, registra MCP, cria guards |
| `./scripts/new-target.sh <slug>` | cria a estrutura de um alvo |
| `./scripts/hash-artifacts.sh <slug>` | registra sha256 dos artefatos |
| `./scripts/detect-target.sh <slug>` | detecta o tipo e recomenda a rota no REA |
| `node scripts/check-spec.mjs <spec> --strict` | portão: bloqueia material contaminado |
| `./scripts/handoff.sh <slug> <versão>` | sela spec + vetores + manifesto |
| `./scripts/verify-isolation.sh [slug]` | audita separação e integridade |
| `./scripts/doctor.sh [--deep]` | diagnóstico completo do kit |
| `npm test` | testa as ferramentas do kit |
| `make help` | atalhos |

## Skills incluídas

| Skill | Onde | Para quem |
| --- | --- | --- |
| `clean-room-orchestrator` | `.claude/skills/` | você, operando na raiz |
| `clean-room-spec` | `rooms/analysis/.claude/skills/` | agente da análise |
| `clean-room-impl` | `rooms/impl/.claude/skills/` | agente da implementação |

Cada sala tem também `AGENTS.md` (Codex) e `CLAUDE.md` (Claude Code). A skill
oficial `reverse-engineer-anything` é instalada pelo `rea setup`. Detalhes:
`docs/08-skills.md`.

## Estrutura

```
rooms/analysis/        sala suja: AGENTS.md, CLAUDE.md, skill clean-room-spec
rooms/impl/            sala limpa: AGENTS.md, CLAUDE.md, skill clean-room-impl
.claude/skills/        skill do operador (orquestração)
targets/<slug>/        um alvo: artifacts, evidence, spec, golden, handoff
scripts/               bootstrap, detecção, portão, handoff, guards, doctor
templates/             spec, vetores, pedido, ficha do alvo, proveniência
examples/pan-mechanic/ exemplo completo (mecânica fictícia) que passa no portão
docs/                  método, instalação, fluxos, alvos, limites, auditoria
docker/impl/           container opcional para a sala limpa
```

## Documentação

| Documento | Para quê |
| --- | --- |
| [docs/00-metodo-clean-room.md](docs/00-metodo-clean-room.md) | método, papéis, níveis de isolamento, o que é auditável |
| [docs/01-instalacao-rea.md](docs/01-instalacao-rea.md) | REA no Claude Code e no Codex, provedores, Windows |
| [docs/02-fluxo-passo-a-passo.md](docs/02-fluxo-passo-a-passo.md) | roteiro completo com prompts e comandos |
| [docs/03-alvos-jogos.md](docs/03-alvos-jogos.md) | Unity, Godot, nativo, ROMs, WASM |
| [docs/04-alvos-apps.md](docs/04-alvos-apps.md) | Electron/JS, .NET, Android, Apple, Python, web |
| [docs/05-limites-legais-e-politica.md](docs/05-limites-legais-e-politica.md) | o que pode, o que não pode, direito brasileiro |
| [docs/06-verificacao-e-auditoria.md](docs/06-verificacao-e-auditoria.md) | provar equivalência e independência |
| [docs/07-solucao-de-problemas.md](docs/07-solucao-de-problemas.md) | erros comuns do REA, dos hooks e do portão |
| [docs/08-skills.md](docs/08-skills.md) | skills, como carregam e como editar |

## FAQ curto

**Claude e Codex na web servem?** Não para o REA: ele é um servidor MCP local.
Use **Claude Code** (CLI/IDE) ou **Codex CLI**. O Claude Desktop também é
suportado pelo `rea setup`, mas ainda é local.

**Preciso dos dois agentes?** Não, mas usar agentes diferentes nas duas salas
reforça a independência (ex.: Claude na análise, Codex na implementação).

**Preciso de Ghidra?** Só para binários nativos. Unity IL2CPP e análise de
JavaScript/Electron, .NET, Godot e containers funcionam sem engine nativa — mas
IL2CPP profundo normalmente pede um provedor para o binário.

**O kit funciona com qualquer jogo/app?** Sim: o processo é por comportamento.
O detector cobre os empacotamentos mais comuns; se o tipo não for reconhecido,
ele sugere inventariar o container primeiro e rodar a detecção no arquivo
principal.

**O clean room garante que não há violação?** Não. Ele reduz risco e produz
trilha de auditoria. A decisão jurídica é sempre do seu advogado.

## Créditos

- [morluto/rea](https://github.com/morluto/rea) — ferramenta de análise (MIT).
- [rea.tools](https://rea.tools/) — guias e casos públicos (ex.: DX-Ball, Notion,
  TH04), úteis para calibrar expectativa de qualidade de evidência.

Este kit é independente e não é afiliado ao projeto REA.
