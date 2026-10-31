# 09 · Reparar a instalação com o Codex

Use esta página quando o kit já está no disco mas o ambiente ainda não está
pronto: `rea` ausente, Node na versão errada, agente sem o MCP registrado, ou a
sensação de que "clonei e o resto não veio".

O princípio: **o Codex diagnostica e conserta o próprio ambiente**, com comandos
que você aprova. Você não precisa decorar nada.

---

## 0. Antes de tudo: você está na branch certa?

O repositório tem duas branches com conteúdos muito diferentes:

| Branch | Conteúdo |
| --- | --- |
| `main` | apenas `README.md` (é o ponto de partida do projeto) |
| `arena/caee944a-silksongrea` | o kit completo: `scripts/`, `rooms/`, `docs/`, `templates/` |

Se você clonou sem `-b`, veio o `main` — e aí **nada** funciona, porque não existe
`scripts/bootstrap.sh`. Sintomas: `ls` mostra só `README.md`; `./scripts/...` dá
"no such file or directory"; `git log --oneline` mostra um único commit.

```bash
# clone correto (pasta nova)
git clone -b arena/caee944a-silksongrea https://github.com/BloomRX/SilksongREA.git cleanroom-rea

# ou, se já clonou: buscar a branch e entrar nela
git fetch origin
git checkout -b arena/caee944a-silksongrea origin/arena/caee944a-silksongrea
```

Confirme com `git log --oneline -1` (deve mostrar o commit do kit, não
"Initial commit") e com `ls scripts/`.

---

## 1. Rode o pré-voo

```bash
node scripts/preflight.mjs
```

Ele não altera nada. Mostra, item por item, o que está ok, o que é aviso e o que
bloqueia, e imprime as correções na ordem. Versões para agente/CI:

```bash
node scripts/preflight.mjs --json     # relatório estruturado
node scripts/preflight.mjs --deep     # + `rea doctor --client <id> --skill` de cada agente
```

Se `node` nem existir, instale o Node 24 primeiro (dentro do WSL, se for o caso):

```bash
# Linux / macOS / WSL
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
exec "$SHELL" -l
nvm install 24 && nvm use 24 && node -v
```

No Windows nativo, prefira WSL2 (`wsl --install`, reinicie, abra o Ubuntu) e
instale o Node **dentro do WSL**. Node no Windows não serve para rodar os
scripts bash do kit.

---

## 2. Problemas mais comuns

| Sintoma no pré-voo | Causa | Correção |
| --- | --- | --- |
| `Repositório … só README` | clone do `main` | `git fetch origin && git checkout arena/caee944a-silksongrea` |
| `Node.js … fora da faixa` | 23/25 ou 22 antigo | `nvm install 24 && nvm use 24` |
| `REA … não está no PATH` | pacote não instalado, ou shell antigo | `npm install --global rea-agents@latest && hash -r` |
| `Agentes … nenhum encontrado` | Codex/Claude Code ausentes | `npm install --global @openai/codex` |
| `REA no Codex … sem registro` | `rea setup` nunca rodou (ou rodou como outro usuário) | `rea setup --client codex --dry-run` e depois sem `--dry-run` |
| `bash … não encontrado` | Windows nativo (PowerShell) | WSL2 ou Git Bash; os scripts são bash |
| `Ghidra … não detectado` | binário ausente ou `GHIDRA_INSTALL_DIR` não exportado | instale o Ghidra e exporte a variável **antes** de abrir o Codex |
| `EACCES` no `npm -g` | npm global em `/usr` sem permissão | use `nvm` (não use `sudo npm -g`) ou configure `npm config set prefix ~/.npm-global` |

Detalhes de cada item estão em [docs/06-verificacao-e-auditoria.md](06-verificacao-e-auditoria.md) e
[docs/07-solucao-de-problemas.md](07-solucao-de-problemas.md).

---

## 3. O prompt para colar no Codex

Abra o Codex **na raiz do repositório** e cole o bloco abaixo inteiro. Ele foi
escrito para o Codex agir sozinho, pedindo sua aprovação só no que é sensível.

```text
Você vai reparar a instalação do kit de clean room deste repositório e provar que
ela funciona. Trabalhe na raiz do repo (onde estão README.md, scripts/ e rooms/).

CONTEXTO
- Repositório: BloomRX/SilksongREA, branch arena/caee944a-silksongrea.
- O kit roda sobre o REA (pacote npm rea-agents), que expõe um servidor MCP.
- Documentação: README.md, docs/01-instalacao-rea.md, docs/09-reparo-com-codex.md.

REGRAS
1. Não edite arquivos do kit (scripts/, docs/, rooms/, templates/, .claude/) para
   "fazer passar". O problema é de ambiente, não de código.
2. Não crie, mova nem apague nada em targets/.
3. Antes de qualquer comando que precise de sudo/administrador, de instalação de
   sistema (apt, winget, choco) ou de download grande, me mostre o comando e
   espere meu ok.
4. Não instale Ghidra, IDA nem Hopper sem eu pedir; se faltar, apenas registre.
5. Não rode análise de nenhum jogo. Este trabalho termina no ambiente pronto.
6. Se um comando falhar, cole o erro real (sem resumir) e proponha a correção;
   não invente saída.

PASSOS
1. Confirme o terreno: `git rev-parse --abbrev-ref HEAD`, `git log --oneline -1`
   e `ls scripts/bootstrap.sh`. Se scripts/ não existir, pare e me diga que estou
   na branch errada, com o comando exato de checkout.
2. Rode `node scripts/preflight.mjs --json` e interprete o JSON. Se `node` não
   existir, pule para o passo 4 e me avise.
3. Corrija as FALHAS na ordem do relatório: branch/arquivos do kit, Node (24.x),
   npm, REA, registro MCP dos agentes. Para cada correção, diga o comando e o
   resultado. Avisos (Ghidra, disco) você apenas reporta.
4. Se precisar instalar Node/REA: use nvm/fnm quando houver; nunca `sudo npm -g`.
   Depois de instalar, rode `hash -r` e confirme com `node -v` e `rea --version`.
5. Registre o REA no meu cliente: `rea setup --client codex --dry-run --json`,
   mostre o plano, e só então `rea setup --client codex --yes`. Se o cliente for
   Claude Code, use `--client claude_code`.
6. Rode `rea doctor --client codex --skill` (ou `--client claude_code`) e
   `./scripts/doctor.sh`, e me mostre a saída. Esses dois são o gate: devem sair 0.
   Não use `rea doctor` sem filtro como critério — ele reprova provedores ausentes
   e clientes que eu não uso; se você rodar, explique isso em vez de "consertar".
7. Rode `node scripts/preflight.mjs` de novo e cole o resumo final.
8. Encerre com um relatório curto:
   - o que estava quebrado e a causa;
   - o que você mudou (comandos exatos);
   - o que depende de mim (reiniciar o Codex, instalar Ghidra, reiniciar o shell);
   - o próximo comando que eu devo rodar quando voltar.

Se algo do passo 3 exigir reiniciar o terminal ou o próprio Codex para valer,
diga isso explicitamente em vez de fingir que já está ativo.
```

### Por que o prompt insiste em reiniciar

O registro MCP é lido na inicialização do Codex. Depois de `rea setup`, feche e
abra o Codex de novo; só então as ferramentas `rea` aparecem. O mesmo vale para
`PATH`: um terminal aberto antes do `npm -g` não enxerga o binário novo.

---

## 4. Depois que o Codex terminar

```bash
node scripts/preflight.mjs --deep          # tudo ok, ou só avisos
rea doctor --client codex --skill          # registro + skill do cliente que você usa
./scripts/doctor.sh                        # kit, hooks, skills, Node
```

Com isso pronto, o fluxo normal é o de [docs/02-fluxo-passo-a-passo.md](02-fluxo-passo-a-passo.md):

```bash
./scripts/bootstrap.sh --client codex --skip-rea --yes
./scripts/new-target.sh silksong
# copie os artefatos do jogo para targets/silksong/analysis/artifacts/
./scripts/hash-artifacts.sh silksong
./scripts/detect-target.sh silksong
```

O `detect-target.sh` termina sugerindo o `rea setup --client codex --tool-families …`
adequado ao tipo detectado. Rode esse comando, reinicie o Codex e só então
entre na sala de análise.

**Ghidra (quando o alvo for Unity IL2CPP ou binário nativo):** instale a versão
mais recente, exporte `GHIDRA_INSTALL_DIR` no seu shell (`~/.bashrc` ou
`~/.zshrc`) e rode `rea setup --client codex` outra vez. Sem isso o provider de
IL2CPP não é registrado e a análise para no primeiro passo.

---

## 5. O que não fazer

- Não copie o jogo para dentro de `rooms/` nem para o repositório: artefatos vão
  em `targets/<slug>/analysis/artifacts/` (ignorado pelo Git) ou ficam fora do repo.
- Não use `sudo npm install -g`: quebra o nvm e cria dois Nodes no PATH.
- Não rode `git push` de `targets/` — o `.gitignore` já bloqueia, mas o hábito
  importa.
- Não peça ao Codex para "consertar" o kit quando o erro é de versão de Node.
