# Spec comportamental separada — Pogo

## 1. Identificação
Rascunho de investigação Pogo 0.1, 2026-10-31, sala de análise.
Documento separado, NÃO selado e NÃO incluído no handoff horizontal 0.1.1.
Artefato sha256: 70713bb2b1f1b0c4c6b7007fa6a8446cf79818cb5e308c48c094c4d1de7114bb.
Versão comercial 1.0.0 informada pelo usuário. Evidência apenas estática.
Zero execuções da referência; não há certificado de equivalência ou constantes calibradas.

## 2. Escopo
Pogo designa aqui o ressalto do jogador associado a um ataque descendente aceito
contra um contato elegível. Essa definição organiza a investigação; não prova
que qualquer inimigo, obstáculo, superfície ou ataque possa produzir ressalto.
A parte sustentada começa quando o sistema já aceitou um evento de ressalto.
A cadeia completa entre botão, ataque, detecção de contato e elegibilidade ainda está aberta.

O recorte investiga preparação do ressalto, passagem ao estado aéreo, retomada da
solicitação vertical e renovação de recursos de movimento aéreo.
Excluídos: dano, arte, áudio, nomes de equipamentos, geometria de ataque, superfícies
específicas, combinações especiais e calibração de trajetória.
Não se aplica o limite horizontal max_speed de 0.1.1 ao movimento combinado de Pogo.

## 3. Contrato observável
Interface proposta para futura medição, não interface da referência.

| Entrada ou saída | Significado | Situação |
| --- | --- | --- |
| Ataque descendente solicitado | Comando do jogador antes de qualquer contato | Aquisição e arbitragem a medir |
| Contato elegível aceito | Evento de ressalto já reconhecido | Precondição do recorte, seleção ainda incompleta |
| Estado aéreo | Jogador deixa de estar apoiado | Sustentado no caminho de ressalto examinado |
| Solicitação vertical | Componente vertical antes da física | Depende da configuração e da janela de subida |
| Recurso de impulso aéreo | Uso anterior pode ser renovado | Sustentado no caminho examinado, disponibilidade da habilidade não inferida |
| Recurso de salto adicional | Uso anterior pode ser renovado | Condicionado à ausência de salto adicional em andamento |

Dois pontos propostos: P0, após o processamento do evento aceito; P1, após a próxima
avaliação elegível da solicitação vertical, antes de gravidade, integração e colisões.
P0 e P1 não são necessariamente o mesmo instante nem o mesmo frame visual.
Número de frames, unidades, frequência física e latência permanecem desconhecidos.

## 4. Comportamento
Conclusões condicionais de inspeção estática, confiança média.

1. No caminho de ressalto padrão examinado, aceitar o ressalto inicia um estado de
   subida e de recuperação do ataque, prepara uma janela configurável e passa ao
   estado aéreo (EV-POGO-011). Isso não determina uma altura ou duração externa.
2. Nesse caminho, o uso anterior de impulso aéreo é renovado. O uso de salto adicional
   é renovado se não há salto adicional em andamento (EV-POGO-011).
   Isso não concede habilidades ausentes nem comprova a possibilidade de encadeá-las imediatamente.
3. A solicitação vertical configurada é aplicada na avaliação elegível da subida,
   enquanto sua janela estiver ativa e sem estados concorrentes impeditivos
   (EV-POGO-011). Não se confirmou o sinal nem o valor da configuração efetiva em jogo.
4. Há uma rota de ressalto enfileirado ligada ao ataque. Ela pode iniciar preparação
   com configuração padrão e processar depois uma configuração associada ao ataque
   (EV-POGO-012). Não prometer um único impulso instantâneo universal.
5. A configuração examinada distingue limites da janela de subida e comportamento
   de cancelamento (EV-POGO-013). A escolha efetiva depende dos dados carregados.
6. Os caminhos de resposta a impacto inspecionados dependem da direção e de propriedades
   do contato; não demonstram que todo contato descendente chama o ressalto padrão
   (EV-POGO-014). A elegibilidade completa permanece uma incerteza.

A velocidade horizontal extra de ressalto ser reiniciada não demonstra que a velocidade
horizontal total seja zerada. Não há contrato horizontal universal neste rascunho.
A confiança média descreve interpretação estática, não observação do jogador em movimento.

## 5. Constantes e tabelas
Nenhuma constante numérica original de Pogo é especificada.

| Grandeza | Situação | Consequência |
| --- | --- | --- |
| Velocidade vertical de ressalto | Configuração efetiva desconhecida | Não fixar magnitude, sinal ou altura por aproximação |
| Janela de subida e recuperação | Configurável, valor efetivo desconhecido | Não fixar duração em frames ou segundos |
| Alcance e geometria do ataque | Não medidos | Não inventar região de contato |
| Gravidade e tolerâncias | Não medidas | Trajetória externa não especificada |
| Velocidade horizontal de variantes | Rotas diferentes, sem calibração | Não unificar variantes arbitrariamente |

Valores de ensaio futuros devem ser rotulados como escolhas do protocolo, nunca como medidos.

## 6. Vetores de teste
Protocolos candidatos, não executados e ainda não publicados como golden selado.
Nenhum deles é acrescentado aos cinco casos horizontais de 0.1.1.

| ID proposto | Preparação e observação | Resultado que se deve confirmar |
| --- | --- | --- |
| pogo-aceito | Ataque descendente, contato elegível isolado, registrar P0 e P1 | Estado aéreo e solicitação vertical configurada na janela válida |
| pogo-renova-impulso | Recurso aéreo já usado, ressalto aceito | Renovação do uso anterior, sem pressupor habilidade desbloqueada |
| pogo-renova-salto | Salto adicional usado, mas não em andamento, ressalto aceito | Renovação do uso anterior |
| pogo-salto-em-curso | Salto adicional em andamento durante ressalto aceito | Ausência da renovação incondicional desse recurso |
| pogo-sem-contato | Ataque descendente sem contato | A medir; não há oráculo negativo completo |
| pogo-contato-recusado | Contato que não admite ressalto | A medir; classificar elegibilidade primeiro |
| pogo-repetido | Dois eventos próximos e diferentes configurações | A medir; separar fila, repetição, cancelamento e novo ataque |

As primeiras quatro conclusões têm suporte estático condicionado; protocolos externos
exigem primeiro identificar uma configuração e um contato reproduzíveis na referência.
Empates entre contatos, ordem de eventos simultâneos, entradas inválidas, contadores
extremos, overflow e duração zero permanecem sem contrato. Não fabricar resultados.

## 7. Incertezas
| ID | Lacuna | Próxima observação |
| --- | --- | --- |
| P-U1 | Elegibilidade e cadeia completa do contato | Rastrear evento aceito desde um ataque e contato concretos |
| P-U2 | Configuração efetiva e variante padrão em jogo | Vincular dados de cena e configuração à mesma build |
| P-U3 | Velocidade, sinal, altura, gravidade e duração | Capturar P0, P1 e trajetória com tempo e unidade calibrados |
| P-U4 | Fila, repetição, interrupção e prioridade de estados | Ensaios com eventos isolados, depois próximos |
| P-U5 | Disponibilidade real dos movimentos aéreos após ressalto | Medir com habilidades habilitadas e desabilitadas |
| P-U6 | Latência do comando e confirmação dinâmica | Executar os protocolos na cópia completa |

Este rascunho não autoriza implementar um Pogo completo na sala limpa nem inferir
constantes a partir de nomes, campos declarados ou valores de construção não calibrados.
Uma futura revisão poderá selar somente o recorte cuja entrada, saída e precondições
estiverem fechadas. Manter este documento na análise até resolver o contrato mínimo.

## 8. Rastreabilidade
Todas as evidências estão vinculadas ao artefato sha256
70713bb2b1f1b0c4c6b7007fa6a8446cf79818cb5e308c48c094c4d1de7114bb.
Bundle sha256: edc54cff79d06989ae1c9cbb1ad1ff0f651ae54329d4c8705c521e97872c2a1a.

| Evidência | Conteúdo sustentado | Método | Confiança |
| --- | --- | --- | --- |
| EV-POGO-011 | Preparação, estado aéreo, recursos aéreos e subida condicional | Inspeção estática dirigida | Média |
| EV-POGO-012 | Rota enfileirada e seleção de configuração do ataque | Inspeção estática dirigida | Média |
| EV-POGO-013 | Parâmetros de janela e cancelamento | Inspeção estática dirigida | Média |
| EV-POGO-014 | Limites da busca de elegibilidade e resposta a impacto | Inspeção estática dirigida | Média para os caminhos examinados |

Data das observações: 2026-10-31. Os registros detalhados permanecem na sala de análise.
Ausência de ligação na busca limitada não prova inexistência de uma ligação em outro lugar.

## 9. Declaração de independência
Declaro que esta spec não contém código, trechos de binário, assets, nomes internos
ou strings proprietárias. As descrições são próprias e limitadas às evidências indicadas.
Declaro que nenhum protocolo foi executado na referência e nenhum valor foi inventado.
Este documento é uma spec separada parcial, não um handoff pronto para implementação.
Autor: agente da sala de análise. Data: 2026-10-31.
