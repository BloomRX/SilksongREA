# Relatórios

- `latest/` é substituído a cada execução e contém somente resumos sanitizados.
- Resultados completos, código decompilado, CIL, inventário CSV e logs brutos ficam em `.local/`, ignorado pelo Git.
- O histórico dos relatórios publicados fica no histórico de commits da branch.

Nenhum arquivo deve ser adicionado manualmente a `latest/` sem antes verificar se contém dados privados, segredos ou material protegido do jogo.
