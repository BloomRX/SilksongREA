# Registro de decisões

## Diretrizes confirmadas pelo usuário

| ID | Diretriz | Origem |
|---|---|---|
| D1 | **OBSERVADO:** usar Silksong como referência para implementação independente, sem portar código ou material do jogo. | Missão inicial. |
| D2 | **OBSERVADO:** priorizar pesquisa, documentação e arquitetura; não implementar mecânicas completas nem alterar projeto de destino nesta sessão. | Missão inicial. |
| D3 | **OBSERVADO:** Hack Overdrive ainda não existe; versão e linguagem não estão configuradas. | Resposta do usuário durante esta sessão. |
| D4 | **OBSERVADO:** este agente deve estudar Silksong e formular propostas relacionadas; Claude Code executará o trabalho de destino e tratará escolhas de engine/jogabilidade. | Esclarecimento do usuário após a entrega inicial. |
| D5 | **OBSERVADO:** commit e push dos estudos sanitizados autorizados para consulta posterior pelo Claude Code. | Esclarecimento do usuário após a entrega inicial. |

## Escolhas operacionais desta pesquisa

- **OBSERVADO:** documentos criados em SilksongREA após confirmação do repositório; não existe projeto de destino para recebê-los.
- **OBSERVADO:** recorte limitado a movimento/pulo/aterrissagem e fronteiras necessárias. Relatórios anteriores e decompilação local foram reaproveitados.
- **OBSERVADO:** não houve execução do pipeline, implementação ou modificação da instalação do jogo. Fontes locais permanecem fora dos documentos produzidos; a publicação autorizada abrange somente os estudos sanitizados.

## Arquitetura ainda não aprovada

| ID | Candidato | Estado / justificativa |
|---|---|---|
| A1 | **PROPOSTA GODOT:** Godot 4.x, versão exata e linguagem a decidir | **PENDENTE:** pressuposto de compatibilidade; não há versão real. |
| A2 | **PROPOSTA GODOT:** CharacterBody2D e único dono do movimento | **PENDENTE:** evita disputa de velocidade; ver proposta. |
| A3 | **PROPOSTA GODOT:** enum pequeno, input separado e perfil Resource | **PENDENTE:** torna transições e comandos auditáveis sem replicar o controlador estudado. |
| A4 | **PROPOSTA GODOT:** pulo por impulso/corte, buffer e janela de borda em segundos | **PENDENTE:** contrato e sensação precisam de aprovação e testes. |
| A5 | **PROPOSTA GODOT:** apresentação por AnimationPlayer e sinais locais | **PENDENTE:** AnimationTree só se houver necessidade concreta. |
| A6 | **PROPOSTA GODOT:** laboratório antes de dash/combate | **PENDENTE:** aguarda autorização de implementação. |

**PENDENTE:** nenhuma decisão de arquitetura de Hack Overdrive foi aprovada nesta sessão. Claude Code poderá avaliar estes candidatos no trabalho de destino conforme as instruções do usuário. Este agente permanece no estudo da referência. Ver [proposta completa](godot_proposal.md) e [perguntas](open_questions.md).
