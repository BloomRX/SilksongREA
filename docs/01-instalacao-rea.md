# Instalação do REA (Claude Code e Codex)

Este documento cobre o que o `./scripts/bootstrap.sh` faz, para você entender e
reparar cada etapa. Versão observada na escrita deste kit: **rea-agents 6.8.0**
(mudança rápida; use `@latest` e leia o CHANGELOG se algo divergir).

> Só instale o REA a partir de fontes oficiais:
> [github.com/morluto/rea](https://github.com/morluto/rea),
> [rea.tools](https://rea.tools/) ou o pacote npm `rea-agents`.
> Repositório parecido com README copiado não é fonte oficial.

## 1. Pré-requisitos

| Item | Requisito |
| --- | --- |
| Node.js | 22.x >= 22.23.4, 24.x >= 24.22.1 ou >= 26.12.1 (23 e 25 **não**) |
| npm | vem com o Node |
| Linux | `ps` compatível com procps no `PATH` (Ghidra/JADX/firmware/exclusão de processos) |
| Windows | WSL2 recomendado; há suporte nativo, com ressalvas |
| Disco | alguns GB se for instalar Ghidra e analisar binários grandes |
| Memória | 8 GB+ confortável para Ghidra em binários médios/grandes |

```bash
node -v && npm -v
rea --version         # se já estiver instalado
```

## 2. Duas rotas — escolha uma por cliente

| Rota | Como | Vantagens | Limitações |
| --- | --- | --- | --- |
| **Setup** (recomendada) | `npx rea-agents setup` | grava caminho absoluto do runtime, instala a skill correspondente, `rea doctor` e `rea uninstall` funcionam | refaz registro ao atualizar |
| **Plugin** | marketplace do Claude Code/Codex | tudo dentro do cliente; skill empacotada | `rea doctor` não vê o plugin; configuração de provedor ainda é manual |

**Não use as duas no mesmo cliente** — você termina com dois servidores `rea`.

## 3. Instalação recomendada (setup + pacote global)

```bash
# 1) pacote global: caminho durável (melhor que npx, que depende do cache)
npm install --global rea-agents@latest
rea --version

# 2) plano, sem escrever nada
rea setup --client claude_code --dry-run
rea setup --client codex --dry-run

# 3) aplicar (pede aprovação antes de escrever)
rea setup --client claude_code
rea setup --client codex
```

O setup:

- registra o servidor MCP `rea` no cliente;
- instala a skill oficial `reverse-engineer-anything` no diretório de skills do
  cliente;
- preserva configurações existentes, cria backup (`.rea.backup`) e valida o
  resultado;
- pode configurar um provedor nativo (Hopper, Ghidra) com aprovação separada.

Depois: **reinicie o agente**.

No kit, isso é automatizado:

```bash
./scripts/bootstrap.sh --clients claude_code,codex
```

### Caminhos que o setup toca

| Cliente | Registro | Skill |
| --- | --- | --- |
| Claude Code | `~/.claude.json` (ou `$CLAUDE_CONFIG_DIR/.claude.json`) | `~/.claude/skills/` |
| Codex | `$CODEX_HOME/config.toml` (padrão `~/.codex/config.toml`) | diretório de skills do cliente |

## 4. Rota plugin

**Claude Code:**

```
/plugin marketplace add morluto/rea
/plugin install rea@rea
```

**Codex CLI:**

```bash
codex plugin marketplace add morluto/rea
codex plugin add rea@rea
```

Verificação (plugin não aparece no `rea doctor`):

```
claude plugin list
/mcp
codex plugin list
```

Para checar disponibilidade de engine no servidor do plugin, peça ao agente para
chamar `binary_session` e ler `result.tool_availability`.

## 5. Só a skill (sem MCP)

```bash
npx skills add morluto/rea --skill reverse-engineer-anything
```

Não registra servidor nem instala engine. Serve para ler as instruções e usar a
CLI manualmente.

## 6. Provedores de análise nativa

| Provedor | Custo | Onde roda | Quando usar |
| --- | --- | --- | --- |
| **Ghidra** | grátis | macOS/Linux; Windows experimental | começar, projetos abertos, maior cobertura de arquiteturas |
| **Hopper** | comercial (demo com limites) | macOS 12+, Linux x86_64 | fluxo rápido no macOS |
| **IDA** | comercial | Windows/macOS/Linux | quem já tem licença; bridge opcional |
| **Kuna** | conforme docs | conforme docs | alternativa |

O REA **não instala** Ghidra/IDA/JADX/Java; ele usa o que existe. Hopper pode ser
instalado pelo setup com aprovação.

```bash
export GHIDRA_INSTALL_DIR=/caminho/para/ghidra     # se não for detectado
rea setup --client codex                           # detecta e salva o Ghidra verificado
rea doctor --provider ghidra --json
```

O servidor herda o ambiente do **cliente**: se o Ghidra só estiver no seu shell,
reinicie o cliente a partir do mesmo shell (ou use `GHIDRA_INSTALL_DIR` no bloco
`env` do registro MCP).

## 7. Contexto e desempenho do MCP

O catálogo de ferramentas do REA é grande. Se o agente reclamar de contexto,
compacte os esquemas e limite famílias:

```bash
# perfis de esquema (gravados no registro pelo setup)
REA_MCP_INPUT_SCHEMA_PROFILE=compact
REA_MCP_OUTPUT_SCHEMA_PROFILE=compact

# limitar famílias (exemplo: aplicação Electron/JS)
rea setup --client claude_code --tool-families browser,electron,application,javascript-runtime,session
```

Famílias comuns:

| Fluxo | Escopo |
| --- | --- |
| Binário nativo | `native,artifact,session` |
| Electron/JS | `browser,electron,application,javascript-runtime,session` |
| .NET | `managed,session` |
| Android | `android,adb,apktool,session` |
| Só evidência | `session` |

O setup preserva overrides existentes (`REA_MCP_INPUT_SCHEMA_PROFILE`,
`REA_MCP_OUTPUT_SCHEMA_PROFILE`, `REA_MCP_MAX_RESPONSE_BYTES`,
`REA_MCP_TOOL_FAMILIES`).

## 8. Timeouts (Codex)

O setup grava `startup_timeout_sec = 30` e calcula `tool_timeout_sec` a partir do
provedor (ex.: 450 s com Ghidra padrão). Binário grande pode exigir mais:

```toml
# ~/.codex/config.toml
[mcp_servers.rea]
startup_timeout_sec = 120
tool_timeout_sec = 900
```

E, no provedor: `REA_GHIDRA_STARTUP_TIMEOUT_MS`.

## 9. Perfis separados (essencial para clean room)

```bash
# SALA DE ANÁLISE — perfil com REA
CLAUDE_CONFIG_DIR=~/.claude-rea npx rea-agents setup --client claude_code
CLAUDE_CONFIG_DIR=~/.claude-rea claude

# SALA LIMPA — perfil sem REA
CLAUDE_CONFIG_DIR=~/.claude-impl claude

# Codex
CODEX_HOME=~/.codex-rea codex
CODEX_HOME=~/.codex-impl codex
```

Mantenha o prefixo em **todos** os comandos daquele perfil (setup, doctor, update,
remoção). Perfil novo pode exigir login.

## 10. Atualização e remoção

```bash
rea update                 # atualiza o pacote global
rea setup --client codex   # atualiza registro/skill e reinicia o cliente

rea uninstall              # remove registros e skill (cuidado: afeta clientes)
```

Handoffs e alvos em `targets/` não são tocados por update/uninstall.

## 11. Windows

**WSL2 (recomendado):** instale Node, Claude Code/Codex e REA dentro do WSL. Os
scripts do kit são bash e rodam sem adaptação.

**PowerShell nativo:** os mesmos passos funcionam, mas variáveis de ambiente são
por sessão:

```powershell
$env:CLAUDE_CONFIG_DIR = Join-Path $HOME ".claude-rea"
npx rea-agents setup --client claude_code
claude
$env:CLAUDE_CONFIG_DIR = $null   # ao terminar
```

Registros usam caminhos absolutos do `node.exe` e do `scripts/rea.mjs`; mover a
instalação quebra o registro.

## 12. Registro manual (último recurso)

Se o cliente não estiver na lista de suportados, registre o servidor stdio:

```json
{
  "mcpServers": {
    "rea": {
      "command": "/caminho/absoluto/para/node",
      "args": ["/caminho/absoluto/para/rea/scripts/rea.mjs", "mcp"]
    }
  }
}
```

Sem skill, o agente ainda pode usar as ferramentas, mas perde as instruções de
workflow — instale a skill separadamente.

## 13. Verificação final

```bash
rea doctor --client claude_code --json
rea doctor --client codex --json
rea doctor --skill --json
rea doctor --provider ghidra --json
./scripts/verify-isolation.sh
```

O `doctor` verifica arquivos e pré-requisitos, não a conexão viva do agente. Se as
ferramentas não aparecerem mesmo com tudo verde, reinicie o cliente.
