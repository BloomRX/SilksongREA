# Sala limpa em container (L3)

Isolamento organizacional (pastas + hooks) protege contra descuido. Container
protege contra **acesso**: dentro dele não existe o alvo, a evidência, a spec de
trabalho nem o REA.

## Uso

```bash
# 1. gere o handoff normalmente, na raiz do kit
./scripts/handoff.sh meu-jogo 0.1.0

# 2. abra a sala limpa no container
./docker/impl/run.sh meu-jogo claude     # ou: codex
```

Na primeira vez a imagem é construída (~2 min). O login do agente é persistido em
`~/.claude-impl` / `~/.codex-impl`, então você autentica uma vez.

Dentro do container:

```
/handoff/v0.1.0/   spec.md · golden.json · manifest.json  (somente leitura)
/work              seu projeto
```

## O que isso garante (e o que não garante)

**Garante**

- nenhum caminho para `analysis/`, `artifacts/`, `evidence/` ou snapshots;
- nenhuma ferramenta de engenharia reversa instalada;
- a implementação não consegue ler o alvo mesmo que o agente tente.

**Não garante**

- que o modelo "lembre" do jogo — isso é política, não filesystem;
- isolamento de rede (o agente precisa de egress para a API do modelo);
- que ninguém copie arquivos manualmente para `/work` — isso seria uma violação
  do processo, detectável no histórico Git.

## Rede

O padrão usa a rede bridge do Docker (necessária para a API do modelo).

Se você roda um modelo local, dá para endurecer:

```bash
docker run --rm -it --network=none \
  -v "$PWD/targets/meu-jogo/handoff:/handoff:ro" \
  -v "$PWD/targets/meu-jogo/impl-src:/work" \
  cleanroom-impl claude
```

(com um endpoint local acessível por socket/volume, conforme seu setup).

## Verificação

```bash
# na raiz do kit
./scripts/verify-isolation.sh meu-jogo

# dentro do container, deve falhar:
rea --version        # command not found
ghidraRun            # command not found
ls /analysis         # não existe
```

## Limpeza

```bash
docker rmi cleanroom-impl
rm -rf targets/meu-jogo/impl-src     # se quiser descartar o trabalho
```
