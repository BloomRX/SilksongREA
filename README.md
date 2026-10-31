# SilksongREA — kit de clean room com REA

Monte um **clean room** (sala limpa) para reimplementar comportamentos de jogos e
apps com agentes — Claude Code e Codex CLI — usando o
[REA (Reverse Engineering Agent)](https://github.com/morluto/rea) só do lado de
quem analisa o original.

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
reversa. O hook do agente barra a sala limpa de tocar no REA, no alvo ou na
análise.

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
git clone <este-repo> silksongrea && cd silksongrea

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

## Uso em 6 passos

```bash
# 1. crie um alvo
./scripts/new-target.sh silksong --name "Hollow Knight: Silksong" --version "1.0.0"

# 2. coloque sua cópia do alvo e registre os hashes
cp -R /caminho/do/jogo targets/silksong/analysis/artifacts/
./scripts/hash-artifacts.sh silksong

# 3. sala de análise: investigue e escreva a spec
cd rooms/analysis && claude      # ou: codex

# 4. portão + handoff selado
cd ../..
node scripts/check-spec.mjs targets/silksong/analysis/spec/spec.md --strict
./scripts/handoff.sh silksong 0.1.0

# 5. sala limpa: implemente só com a spec (sessão nova, de preferência outro agente)
cd rooms/impl && claude          # ou: codex

# 6. audite
cd ../.. && ./scripts/verify-isolation.sh silksong
```

### Prompt para a sala de análise

```text
Leia AGENTS.md e a skill clean-room-spec.
Alvo: ../../targets/silksong/analysis/artifacts (versão 1.0.0).
Quero entender <comportamento específico>. Produza a spec em
../../targets/silksong/analysis/spec/spec.md e os vetores em golden.json.
Registre evidência e incertezas. Não escreva código de produto.
```

### Prompt para a sala limpa

```text
Leia AGENTS.md e a skill clean-room-impl.
Implemente ../../targets/silksong/handoff/v0.1.0 com <stack>.
Comece transformando cada caso de golden.json em teste.
Se a spec for ambígua, crie um pedido de esclarecimento; não invente.
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `./scripts/bootstrap.sh` | instala/atualiza REA, registra MCP, cria guards |
| `./scripts/new-target.sh <slug>` | cria a estrutura de um alvo |
| `./scripts/hash-artifacts.sh <slug>` | registra sha256 dos artefatos |
| `node scripts/check-spec.mjs <spec> --strict` | portão: bloqueia material contaminado |
| `./scripts/handoff.sh <slug> <versão>` | sela spec + vetores + manifesto |
| `./scripts/verify-isolation.sh [slug]` | audita separação e integridade |
| `npm test` | testa as ferramentas do kit |
| `make help` | atalhos |

## Estrutura

```
rooms/analysis/        sala suja: AGENTS.md, CLAUDE.md, skill clean-room-spec
rooms/impl/            sala limpa: AGENTS.md, CLAUDE.md, skill clean-room-impl
targets/<slug>/        um alvo: artifacts, evidence, spec, golden, handoff
scripts/               bootstrap, portão, handoff, guards, verificação
templates/             spec, vetores, pedido de esclarecimento, ficha do alvo
examples/pan-mechanic/ exemplo completo (mecânica fictícia) que passa no portão
docs/                  método, instalação, fluxos, alvos, limites, auditoria
docker/impl/           container opcional para a sala limpa
```

## Alvos suportados pelo REA

Jogos: binários nativos, Unity IL2CPP (`global-metadata.dat`), UnityFS
AssetBundles, Godot PCK, WASM, Android, Flutter, Harmony, DOS/N64/PSP/PPC/MIPS
via Ghidra. Apps: Electron/ASAR e JavaScript, .NET gerenciado, Android/JADX,
Apple, Python empacotado, firmware, web/capturas.

Roteiro por tipo de alvo: `docs/03-alvos-jogos.md` e `docs/04-alvos-apps.md`.

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

## FAQ curto

**Claude e Codex na web servem?** Não para o REA: ele é um servidor MCP local.
Use **Claude Code** (CLI/IDE) ou **Codex CLI**. O Claude Desktop também é
suportado pelo `rea setup`, mas ainda é local.

**Preciso dos dois agentes?** Não, mas usar agentes diferentes nas duas salas
reforça a independência (ex.: Claude na análise, Codex na implementação).

**Preciso de Ghidra?** Só para binários nativos. Unity IL2CPP e análise de
JavaScript/Electron, .NET, Godot e containers funcionam sem engine nativa — mas
IL2CPP profundo normalmente pede um provedor para o binário.

**O clean room garante que não há violação?** Não. Ele reduz risco e produz
trilha de auditoria. A decisão jurídica é sempre do seu advogado.

## Créditos

- [morluto/rea](https://github.com/morluto/rea) — ferramenta de análise (MIT).
- [rea.tools](https://rea.tools/) — guias e casos públicos (ex.: DX-Ball, Notion,
  TH04), úteis para calibrar expectativa de qualidade de evidência.

Este kit é independente e não é afiliado ao projeto REA.
