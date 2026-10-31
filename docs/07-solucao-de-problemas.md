# Solução de problemas

## 1. REA / instalação

### Node.js incompatível

```
REA installation failed: Node.js v22.22.3 is unsupported.
```

O REA exige 22.x (>= 22.23.4), 24.x (>= 24.22.1) ou >= 26.12.1. **23 e 25 não são
suportados.**

```bash
nvm install 24 && nvm use 24
# ou
fnm install 24 && fnm use 24
node -v
```

### `rea: command not found` depois do npx

`npx` não instala globalmente. Para uso durável:

```bash
npm install --global rea-agents@latest
rea --version
```

Se o registro foi criado a partir do cache do npx, ele aponta para um caminho de
cache. Não limpe o cache do npm; ou reinstale global e rode o setup de novo.

### `doctor` diz `missing` mas o plugin está instalado

`rea doctor` **não vê** estado de plugin. Verifique no cliente:

```
claude plugin list
/mcp
codex plugin list
```

E **não** rode `rea setup` para "consertar" — você acabaria com dois servidores.

### MCP registrado, mas ferramentas não aparecem

1. Reinicie o cliente (registro só é lido no início).
2. Confira `rea doctor --client <claude_code|codex>`.
3. Veja se o escopo de famílias escondeu o que você precisa:
   `REA_MCP_TOOL_FAMILIES` / `rea setup --tool-families …`.
4. Em catálogos grandes, reduza o contexto:
   `REA_MCP_INPUT_SCHEMA_PROFILE=compact`, `REA_MCP_OUTPUT_SCHEMA_PROFILE=compact`.
5. Codex: aumente `startup_timeout_sec` / `tool_timeout_sec`.

### Contexto estourando no Claude Code

Sintoma: "autocompact thrashing". Causa: catálogo de ferramentas grande enviado a
cada request. Correções:

- `--tool-families` só com o necessário;
- `REA_MCP_INPUT_SCHEMA_PROFILE=compact`;
- `REA_MCP_OUTPUT_SCHEMA_PROFILE=compact` ou `off`;
- ajustar `CLAUDE_CODE_MAX_CONTEXT_TOKENS` se o modelo não for reconhecido.

### `ps` ausente (Linux)

Ghidra, JADX, firmware e análise JS estática usam `ps` compatível com procps para
checagem de posse de processo. Instale `procps` na sua distro.

### Ghidra não detectado

```bash
rea doctor --provider ghidra --json
export GHIDRA_INSTALL_DIR=/caminho/para/ghidra
GHIDRA_INSTALL_DIR=/caminho/ghidra rea setup --client codex
```

O agente herda o ambiente do **cliente**, não do seu terminal. Se você exportou a
variável só no shell, reinicie o cliente pelo mesmo shell.

### Hopper pedindo licença/dialog na primeira execução

Resolva manualmente na mesma sessão de usuário antes de rodar operações
automatizadas. O REA inicia o Hopper sob demanda.

### Setup bloqueado por configuração existente

O REA recusa sobrescrever registro de origem desconhecida ou configuração
malformada. Rode:

```bash
rea setup --client <id> --dry-run --json
```

O plano aponta o arquivo, o backup e o que precisa ser corrigido. Backups ficam em
`<arquivo>.rea.backup`. Não apague backups: eles são sua recuperação.

### Atualização

```bash
rea update
rea setup --client <id>        # atualiza registro/skill
```

Reinicie o cliente.

---

## 2. Kit / scripts

### `bootstrap.sh` para na checagem de Node com `--skip-rea`

Só é bloqueante quando o REA será instalado. Com `--skip-rea` ele avisa e continua.

### Hook não roda / "command not found"

O `bootstrap.sh` grava `rooms/<sala>/.claude/settings.local.json` com o caminho
**absoluto** do guard. Se você moveu o repositório:

```bash
./scripts/bootstrap.sh --skip-rea --yes
```

Confira o JSON gerado e reinicie o Claude Code.

### O guard bloqueou algo legítimo

Leia a mensagem: ela diz a regra. Casos comuns:

- comando contém a palavra `rea` em outro contexto (ex.: `grep rea arquivo`);
- caminho com `/analysis/` que não é a sala de análise;
- `artifacts/` em um projeto seu sem relação com o alvo.

Corrija o comando (caminho absoluto, outro nome) ou ajuste as listas em
`scripts/guard-impl.mjs` **com revisão humana**. Nunca desative o hook "só desta
vez" em trabalho sério — o valor dele é justamente não ser opcional.

### `check-spec` bloqueia minha spec

| Bloqueio | Correção |
| --- | --- |
| `codigo-proibido` | remova o bloco de código; descreva em linguagem natural e use JSON para vetores |
| `material-derivado` | remova símbolos como `sub_`, `FUN_`, `vtable`, nomes de ferramentas, dumps |
| `secao-faltando` | use as 9 seções do template |
| `declaracao-ausente` | escreva a declaração da seção 9 com "declaro", "não" e "código" |
| `pedido-de-codigo` | pedido de esclarecimento não pode pedir implementação |

Avisos comuns: offsets `0x…` (só se forem formato público observável), caminhos
`artifacts/`, extensões de código citadas. Resolva ou justifique.

### `handoff.sh` recusa golden vazio

Intencional: handoff sem vetores não é handoff. Produza casos reais.

### "Permission denied" ao apagar um handoff

Handoffs são somente-leitura de propósito:

```bash
chmod -R u+w targets/<slug>/handoff/v0.1.0
rm -rf targets/<slug>/handoff/v0.1.0
```

Prefira gerar nova versão em vez de apagar.

### `verify-isolation.sh` falha

| Mensagem | Correção |
| --- | --- |
| `rea está no PATH` | você está na máquina errada ou falta L2/L3; remova o global ou use container |
| `sala X sem hook` | rode `./scripts/bootstrap.sh --skip-rea --yes` |
| `handoff adulterado` | alguém editou o selo; gere nova versão a partir da spec |
| `symlink em rooms/impl` | remova o atalho; ele fura o isolamento |
| `material sensível versionado` | `git rm --cached` e confira `.gitignore` |

---

## 3. Windows

- **WSL2** evita 90% dos problemas: rode tudo dentro dele.
- Em PowerShell, variáveis de ambiente valem por sessão; use `$env:NOME`.
- Caminhos com espaço: sempre entre aspas.
- Mover instalações invalida registros que guardam caminho absoluto.
- Handoffs em somente-leitura podem impedir deleção no Explorer; use `attrib -R`.

---

## 4. "Não sei se meu processo está certo"

Faça o teste do auditor:

1. Pegue só `handoff/vX.Y.Z/` e apague (mentalmente) todo o resto.
2. Você consegue implementar e testar? Se não, a spec está incompleta.
3. Um terceiro consegue dizer de onde veio cada número da spec? Se não, falta
   evidência.
4. Alguém consegue provar que a sala limpa viu o original? Se sim, o isolamento
   falhou.

---

## 5. Reset controlado

```bash
# refazer guards/settings
./scripts/bootstrap.sh --skip-rea --yes

# apagar um alvo de teste
chmod -R u+w targets/meu-teste && rm -rf targets/meu-teste

# refazer o REA
rea uninstall
npm install --global rea-agents@latest
rea setup --client claude_code
```

Nunca faça reset em cima de um handoff já entregue sem registrar o motivo no
`audit/log.jsonl`.
