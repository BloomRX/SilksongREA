# SilksongREA

Setup local para Windows que localiza **Hollow Knight: Silksong** na Steam, executa análises estáticas com **REA + ILSpyCmd**, coleta diagnósticos e publica relatórios sanitizados no Git.

O objetivo é produzir evidências para estudar mecânicas e depois reimplementá-las na Godot — não redistribuir o jogo nem criar um port automático.

## Execução rápida

1. Clone este repositório no mesmo computador em que o jogo está instalado.
2. Confira a branch com `git branch --show-current`. O executor publica na **branch atual** e nunca troca de branch.
3. Dê dois cliques em:

   ```text
   ANALISAR_SILKSONG.bat
   ```

4. Se o jogo não for encontrado, cole a pasta aberta pela Steam em **Gerenciar → Explorar arquivos locais**.
5. Ao final, abra [`reports/latest/README.md`](reports/latest/README.md).

A primeira execução pode demorar bastante. Reserve alguns gigabytes para resultados locais e mantenha conexão com a internet para baixar as ferramentas.

## O que o `.bat` prepara

- Node.js 22.19+, 24.11+ ou 26+; se necessário, tenta instalar o Node LTS com `winget`.
- Git, somente se a publicação estiver ativada e o Git não estiver disponível.
- Dependências do repositório com `npm ci`, incluindo **REA 6.7.0** fixado no lockfile.
- .NET SDK 10 e **ILSpyCmd 11.1.0.9782**, somente quando a decompilação for executada.

O `winget` e instaladores podem apresentar solicitações do Windows. Nenhuma política de execução do PowerShell é alterada permanentemente: o `Bypass` vale apenas para o processo iniciado pelo `.bat`.

## Etapas da análise

Cada etapa é independente; uma falha é registrada e as demais continuam quando possível.

| Etapa | Resultado local |
|---|---|
| Sincronização Git | `pull --rebase --autostash` quando a árvore está limpa |
| Detecção do jogo | Bibliotecas Steam, manifest do app `1030300`, layout Mono/IL2CPP |
| Inventário | Todos os caminhos e tamanhos em CSV; contagens por extensão/diretório |
| Integridade | SHA-256 do executável, `Assembly-CSharp.dll`, UnityPlayer e arquivos IL2CPP relevantes |
| REA gerenciado | Identidade de todos os assemblies de `Managed` |
| Assembly principal | Membros, assinaturas, relações e CIL de `Assembly-CSharp.dll` |
| Tipos prioritários | Inspeção focada em `HeroController`, estados, input, `GameManager` e `PlayerData` |
| Fronteiras nativas | P/Invoke e indicadores de implementação nativa |
| PE | Recursos dos executáveis quando o comando é suportado pelo REA publicado |
| IL2CPP | Fallback para `global-metadata.dat`, incluindo binário correspondente quando disponível |
| ILSpy | Decompilação completa do `Assembly-CSharp.dll` para C# local |
| Diagnóstico do jogo | Termos de erro/aviso nos `Player.log` convencionais |
| Relatórios | Markdown + JSON sanitizados em `reports/latest` |
| Publicação | Commit somente dos relatórios e push para `origin` na branch atual |

O pipeline **não executa o jogo, não substitui DLLs, não instala mods e não altera saves**.

## O que vai para o Git — e o que não vai

### Publicado em `reports/latest`

- status e duração das etapas;
- versões e cobertura das ferramentas;
- contagens do inventário e hashes da build;
- resumo das inspeções e da decompilação;
- diagnósticos com caminhos de usuário removidos e segredos redigidos;
- pequenos trechos relevantes de `Player.log`, com limite de tamanho.

### Mantido somente em `.local/` (ignorado pelo Git)

- JSON/Evidence completo do REA e CIL;
- código C# decompilado pelo ILSpy;
- CSV com todos os arquivos;
- logs brutos e saídas de comandos;
- configuração com a pasta local do jogo;
- resultado da última publicação.

São mantidas no máximo **duas execuções brutas**; a decompilação atual é atualizada no lugar. O histórico dos resumos publicados permanece no Git.

Ferramentas instaladas em `.tools/` e `node_modules/` também são ignoradas. Antes do commit, o executor limita os relatórios a arquivos `.md`/`.json`, verifica tamanho e bloqueia padrões de credenciais e caminhos privados.

> Não mova o conteúdo de `.local/` para o Git. Código decompilado e assets continuam sendo material do jogo.

## Opções

As opções podem ser passadas pelo terminal ou por um atalho para o `.bat`:

```bat
ANALISAR_SILKSONG.bat --game-path "D:\SteamLibrary\steamapps\common\Hollow Knight Silksong"
ANALISAR_SILKSONG.bat --no-publish
ANALISAR_SILKSONG.bat --no-decompile
ANALISAR_SILKSONG.bat --no-player-log
ANALISAR_SILKSONG.bat --note "Investigar pulo, coyote time e input buffer"
```

- `--no-publish` / `--no-push`: não executa pull, commit nem push.
- `--no-decompile`: evita a instalação do .NET/ILSpy e a decompilação; útil para um diagnóstico rápido.
- `--no-player-log`: não lê logs fora da pasta do jogo.
- `--note`: acrescenta uma observação ao relatório.
- `--help`: mostra todas as opções.

Para execução automatizada sem a pausa final do `.bat`, defina `SILKSONG_REA_NO_PAUSE=1`. Para impedir instalações automáticas do .NET pelo analisador, defina `SILKSONG_REA_SKIP_INSTALL=1`.

## Comportamento do Git

- O pull inicial só ocorre se não houver alterações locais.
- O commit usa `git add -- reports/latest`, nunca `git add -A`.
- Alterações staged fora desse diretório cancelam somente a publicação.
- Merge/rebase em andamento ou falha ao gerar o relatório também cancelam a publicação.
- Não há force push, criação automática de PR ou mudança de branch.
- Se o commit for criado e o push falhar, o commit local é preservado e o erro é registrado em `.local/last-publication.json`.
- Como um erro de push não pode ser enviado pelo próprio push, o diagnóstico da publicação anterior aparece no relatório da execução seguinte.
- Se não houver mudança nos relatórios, nenhum commit vazio é criado.

Depois que uma execução for publicada, peça ao agente para **ler `reports/latest` na branch correspondente**.

## Limites da cobertura

“Análise completa” aqui significa todas as inspeções estáticas automatizadas por este setup, com cobertura explícita. Isso não equivale a entender todo o jogo:

- FSMs do **PlayMaker**, prefabs, cenas e valores serializados exigem ferramentas e investigação adicionais.
- FsmMaster/BepInEx e análise dinâmica não são instalados automaticamente.
- Assets não são exportados com AssetRipper.
- Descompilação nativa profunda com Ghidra/IDA/Hopper fica fora do fluxo padrão.
- O `Player.log` pode não existir e a busca por termos de erro não prova causa raiz.
- Código e parâmetros da Unity precisam ser reinterpretados antes de uma implementação na Godot.

## Uso manual e desenvolvimento

Requer Node.js compatível e Git:

```bash
npm ci --ignore-scripts --omit=optional
npm run analyze -- --no-publish --no-decompile
npm test
npm run check
```

Estrutura principal:

```text
ANALISAR_SILKSONG.bat       # entrada para dois cliques
scripts/bootstrap.ps1       # Node, Git e dependências
scripts/run-analysis.mjs    # orquestração e recuperação por etapa
scripts/lib/               # detecção, ferramentas, relatórios e Git
reports/latest/            # único resultado publicado automaticamente
.local/                    # resultados completos locais; nunca commitar
.tools/                    # ILSpyCmd local; nunca commitar
```

## Solução de problemas

- **Jogo não encontrado:** use `--game-path` ou cole a pasta quando solicitado. Não aponte para `steamapps`; aponte para a pasta que contém o executável e `Hollow Knight Silksong_Data`.
- **Outra análise em execução:** aguarde. Se uma execução anterior foi encerrada à força, o lock obsoleto é detectado e removido na próxima tentativa.
- **Falha no .NET/NuGet:** confira internet e execute novamente, ou use `--no-decompile` para manter as outras análises.
- **Falha de autenticação Git:** configure a conexão Git/GitHub fora do executor. Nenhum token deve ser colocado em arquivos, argumentos ou chat.
- **Push rejeitado:** sincronize a branch e execute novamente. O executor não força o push nem sobrescreve trabalho remoto.
- **Relatório bloqueado:** leia o motivo na janela e em `.local/last-publication.json`; a proteção impede publicação de segredos/caminhos privados.
