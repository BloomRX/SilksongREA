# Perguntas, hipóteses e próximos passos

## Pontos de implementação para Claude Code

**OBSERVADO:** o usuário atribuiu a execução e as escolhas de engine/jogabilidade ao Claude Code. Os pontos abaixo ficam registrados para esse trabalho futuro; não são solicitações de resposta ao usuário nesta pesquisa nem impedem a continuação do estudo de Silksong.

1. **PENDENTE:** qual versão Godot 4.x e linguagem serão adotadas? GDScript tipado é candidato; não existe projeto configurado.
2. **PENDENTE:** qual escala de mundo, tamanho do personagem e identidade de movimento desejados? Resposta horizontal direta ou aceleração perceptível? Controle aéreo igual ou reduzido?
3. **PENDENTE:** aprovar altura variável, buffer de pulo e coyote time? Um toque encerrado antes de aterrissar deve executar pulo curto ou cancelar a intenção?
4. **PENDENTE:** quais habilidades pertencem ao primeiro protótipo? Proposta inicial: andar e pular; dash e combate ficam como fronteiras especificadas.
5. **PENDENTE:** aceitar limpeza de comandos ao bloquear controle e nova pressão na retomada? Pausa simples deve preservar ou limpar intenção?
6. **PENDENTE:** aprovar arquitetura e futuro laboratório antes de criar projeto ou mecânicas. Esta sessão não aprova sua própria proposta.

## Confirmação empírica da referência

| Questão | Estado / evidência atual | Como reduzir incerteza |
|---|---|---|
| Resposta horizontal efetiva no chão/ar | **HIPÓTESE:** atribuição direta domina o movimento normal; há filtros e exceções. | Capturar deslocamento por frame com câmera estável, mesma situação e controle; repetir inversão e soltura. |
| Duração do pulo e corte ao soltar | **PENDENTE:** mecanismos vistos, sem valores de instância ou passo físico confirmados. | Comparar toque curto e botão mantido, medir subida/ápice em várias repetições. |
| Janela de borda e buffer | **INFERIDO:** evidência de elegibilidade, consumo e decrementos; duração percebida desconhecida. | Varrer offsets de pressão ao sair da borda e antes de aterrissar; manter/soltar em séries separadas. |
| Papéis da fila auxiliar e das filas de ação | **PENDENTE:** a retomada de controle usa fila auxiliar; não há contrato universal demonstrado. | Estudar apenas os consumidores necessários a uma futura questão; não somar durações das filas. |
| Aterrissagem forte | **PENDENTE:** entrada e recuperação vistas; limiar completo não estudado. | Investigar `ShouldHardLand` e `FallCheck` se essa mecânica for escolhida; depois validar por quedas controladas. |
| Eventos de sprint e dash | **PENDENTE:** envios vistos; grafos e receptores não inspecionados. | Primeiro decidir se é útil a Hack Overdrive; depois pesquisa focal de FSM/observação, sem exportação pública. |
| Configuração real | **PENDENTE:** campos e Resources Unity localizados, prefabs não lidos. | Preferir medir comportamento; não adotar inicializadores como valores efetivos. |
| Esquiva e invulnerabilidade | **PENDENTE:** não estudadas; nome `Evade` e dash não demonstram equivalência. | Definir necessidade; só então rastrear caminho e testar casos específicos. |

**PROPOSTA GODOT — protocolo de medição:** registrar build, habilidade/equipamento, superfície, câmera, dispositivo, FPS de captura e repetição. Medir em unidades relativas ao tamanho do personagem quando a câmera impede conversão direta. Reportar intervalo e incerteza, nunca precisão maior que a amostragem. Não alterar saves ou instalar instrumentação nesta pesquisa inicial.

## Backlog de pesquisa por valor, custo e incerteza

| Ordem | Próxima atividade | Valor esperado | Custo | Incerteza reduzida |
|---|---|---|---|---|
| 1 | **PENDENTE:** aprofundar aterrissagem em Silksong: `ShouldHardLand` e `FallCheck`, com proposta independente de contrato de contato/recuperação | Alto: completa a fronteira já estudada | Baixo/médio | Critérios de aterrissagem e interrupções |
| 2 | **PENDENTE:** mapear início, atualização e término do dash/sprint, separando lógica C# e fronteiras FSM | Alto: esclarece posse do movimento | Médio/alto | Priorização e limpeza de estado |
| 3 | **PENDENTE:** medir poucas referências observáveis de Silksong, se desejado | Médio/alto: calibra comparações | Médio | Janelas e arco efetivo |
| 4 | **PENDENTE:** rastrear esquiva e sua relação com dano/invulnerabilidade | Condicional | Médio | Diferença entre nomes de ações e comportamento |

**PENDENTE:** nenhuma dessas tarefas foi iniciada automaticamente. Próxima pesquisa recomendada: item 1. Criar projeto, escolher engine/linguagem e implementar laboratório ficam com Claude Code; a proposta e os testes existentes são referências para esse trabalho.
