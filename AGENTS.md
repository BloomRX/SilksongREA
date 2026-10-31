# Kit de clean room com REA

Este repositório tem **duas salas** e uma regra central: **a spec é o único canal
entre elas**.

| Sala | Caminho | Pode ver | Produz |
| --- | --- | --- | --- |
| Análise ("suja") | `rooms/analysis` | alvo, REA, evidências | `spec.md` + `golden.json` |
| Implementação ("limpa") | `rooms/impl` | só o handoff | código + testes |

Antes de agir, identifique onde você está:

- Se o diretório de trabalho é `rooms/analysis` ou `targets/<slug>/analysis`,
  siga **`rooms/analysis/AGENTS.md`**.
- Se o diretório de trabalho é `rooms/impl`, siga **`rooms/impl/AGENTS.md`**.
- Na raiz, você está só orquestrando o processo: não analise alvo nem escreva
  código de produto aqui.

## Regras que valem nas duas salas

1. **Nunca copie expressão do original.** Sem código, sem trechos de binário, sem
   strings proprietárias, sem assets (arte, áudio, texto, mapas, nomes, marcas).
2. **Somente software que o usuário possui ou está autorizado a examinar.**
   Nada de contornar DRM, anti-cheat, verificação de licença ou autenticação.
3. **Toda afirmação precisa de evidência** (ID de evidência + digest do artefato).
   O que não foi observado vai para "Incertezas", nunca vira suposição silenciosa.
4. **Não invente comportamento.** Ambiguidade na sala limpa vira pedido de
   esclarecimento, não palpite implementado.
5. **Nada de material da análise no Git.** `artifacts/`, `evidence/`, `handoff/`
   ficam fora do versionamento.

## Comandos

```bash
./scripts/bootstrap.sh                      # Node, REA, MCP, guards
./scripts/new-target.sh <slug> --name ...   # cria a estrutura de um alvo
./scripts/hash-artifacts.sh <slug>          # proveniência dos artefatos
node scripts/check-spec.mjs <spec> --strict # portão da spec
./scripts/handoff.sh <slug> <versão>        # sela o pacote para a sala limpa
./scripts/verify-isolation.sh [slug]        # audita separação e integridade
```

## O que o REA faz aqui

O REA é o instrumento da **sala de análise**: ele conecta o agente a ferramentas
de inspeção de binários nativos, JavaScript/Electron, .NET, Android, arquivos
UnityFS/Godot, firmware e web, e devolve resultados **com evidência e limites**.
Ele não implementa nada e não deve ser usado na sala limpa.

Detalhes: `docs/00-metodo-clean-room.md` (método e limites),
`docs/01-instalacao-rea.md` (instalação), `docs/02-fluxo-passo-a-passo.md`
(roteiro), `docs/03-alvos-jogos.md` e `docs/04-alvos-apps.md` (por tipo de alvo),
`docs/05-limites-legais-e-politica.md` (o que não fazer).
