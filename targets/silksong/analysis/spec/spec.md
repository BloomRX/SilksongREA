# Spec comportamental — movimento horizontal normal

## 1. Identificação
Revisão 0.1.1, preparada em 2026-10-31 pela sala de análise.
Versão da referência informada pelo usuário: 1.0.0; identificação comercial não comprovada.
Artefato sha256: 70713bb2b1f1b0c4c6b7007fa6a8446cf79818cb5e308c48c094c4d1de7114bb.
Identidade confirmada em EV-MOV-011. Evidência comportamental exclusivamente estática.
Esta revisão é testável por invariantes condicionais; não certifica equivalência dinâmica.
Nenhum cenário foi executado na referência. A revisão selada 0.1.0 permanece imutável.

## 2. Escopo
Somente cinco casos: mov-parado-anda, mov-solta, mov-vira-esq, mov-vira-dir e mov-max.
O objeto de teste é a velocidade horizontal solicitada pelo movimento normal.
Resposta à parede e valor numérico original da máxima estão fora do escopo;
serão medidos em jogo para 0.2.0. Pogo é investigado em documento separado e não integra este pacote.
Também ficam fora: posição, trajetória, gravidade, pulo, combate, impulsos, rampas de terreno,
movimentos especiais, modificadores de velocidade, animação, recursos artísticos e áudio.

As precondições valem antes de cada avaliação: jogador vivo e controlável em solo plano,
sem pausa, transição, controle bloqueado, ataque ou recuperação, dash, corrida especial,
deslizamento ou trava na parede, contato lateral ou inclinado que restrinja a entrada,
zona de caminhada lenta, melhoria de velocidade, força externa ou velocidade adicional.
Não há transporte, vento, recuo, ajuste de borda nem outro sistema alterando a amostra.
A direção já foi aceita pelo controlador e o ramo normal está habilitado.
As exclusões isolam o caminho sustentado por EV-MOV-012 e EV-MOV-013; não afirmam
que esses estados ou efeitos sejam inexistentes no sistema completo.

Aceite: as cinco invariantes devem passar para cada parâmetro de ensaio declarado,
respeitando as precondições e o ponto de amostragem. Isso verifica o contrato limitado.

## 3. Contrato observável
Esta é uma interface de ensaio, definida aqui, não uma interface interna da referência.

| Campo | Tipo e unidade | Domínio válido | Semântica |
| --- | --- | --- | --- |
| direction_by_step | sequência de inteiros, sem unidade | -1, 0, 1 | Esquerda, neutro, direita já aceitos |
| frames | inteiro, avaliações | positivo e igual ao tamanho da sequência | Uma avaliação por elemento |
| max_speed | número, unidades de ensaio por segundo | finito e estritamente positivo | Parâmetro da implementação, fixo durante o caso |
| velocity | número assinado, mesma unidade de max_speed | finito | Solicitação horizontal no ponto S |
| assertion_steps | índices inteiros a partir de zero | dentro da sequência | Amostras às quais aplicar expected |
| transition_step | índice inteiro | maior que zero, dentro da sequência | Primeira avaliação da nova direção |

Ponto S: imediatamente após determinar a solicitação horizontal da direção aceita,
antes de ajustes de borda, recuo, forças adicionais, integração de posição e resolução de colisões.
A implementação deve expor essa solicitação para teste; ler somente a velocidade depois
da física não atende ao protocolo. No recorte, velocidades adicionais estão ausentes.
Não se exige reproduzir organização interna, objetos, nomes ou ordem de chamadas da referência.

Cada frame é uma avaliação lógica do controlador com a direção indicada mantida até S.
Não é frame renderizado nem duração medida. A frequência física da referência é desconhecida.
A amostra inicial anterior ao passo zero é repouso, velocity igual a zero.
Cada caso e cada valor de max_speed começam em estado independente.

Entrada vazia, direção fora do domínio, direções simultâneas, duração inválida,
max_speed zero, negativo ou não finito e overflow invalidam o ensaio, antes de avaliá-lo.
Isso é uma restrição do protocolo; a resposta da referência a esses dados não foi observada.
Não há arbitragem de empate nem divisão por max_speed neste contrato.

## 4. Comportamento
Confiança média, por inspeção estática; nenhum item foi confirmado por execução.

1. No caminho normal examinado, a direção define diretamente a velocidade horizontal,
   sem rampa de aceleração (EV-MOV-012).
2. Para direita, a solicitação tem sinal positivo e módulo igual à velocidade normal
   configurada; para esquerda, sinal negativo com o mesmo módulo. Nesta implementação
   independente, esse módulo é o parâmetro max_speed (EV-MOV-012; escolha de parametrização).
3. Mantendo direção e parâmetro, a solicitação é constante desde a primeira avaliação
   em que a direção aceita aparece, incluindo a partida do repouso (EV-MOV-012).
4. Soltar significa fornecer direção zero. A solicitação é exatamente zero na avaliação
   correspondente, sem rampa de desaceleração nesse caminho (EV-MOV-012, EV-MOV-013).
5. Inverter entre -1 e 1 troca imediatamente o sinal solicitado, sem amostra intermediária
   zero ou com o sinal anterior (EV-MOV-012, EV-MOV-013).
6. No ponto S e sob as precondições, o módulo da solicitação nunca excede max_speed:
   é zero com direção neutra e igual a max_speed com direção não nula (EV-MOV-012).

Imediatamente significa no ponto S da mesma avaliação que recebe a nova direção aceita.
Não significa no instante físico de pressionar o botão, em um número conhecido de
milissegundos ou no mesmo frame visual. Latência de aquisição e filtragem não foi medida.
A ausência de desaceleração intermediária refere-se à solicitação amostrada, não à
trajetória durante colisões, à interpolação visual ou ao comportamento pós-física.

## 5. Constantes e tabelas
max_speed é PARÂMETRO da implementação. Seu valor original é desconhecido; não o estimar.
Os valores abaixo são escolhas declaradas do ensaio e não medições nem constantes da referência.

| Elemento | Valor ou regra | Origem |
| --- | --- | --- |
| Valores de max_speed nos ensaios | 1 e 2.5 unidades de ensaio por segundo | Escolha de protocolo; executar cada caso para ambos |
| Direções | -1, 0, 1 | Codificação de protocolo |
| Frames | 4 nos quatro primeiros casos; 8 em mov-max | Horizonte de ensaio escolhido |
| Tolerância absoluta | 0 | Igualdade da solicitação, sem integração física |
| Frequência física e escala original | Desconhecidas | U-012 |
| Máxima original | Desconhecida e excluída de 0.1.1 | U-011; investigar em 0.2.0 |

Não há valor padrão de produção autorizado para max_speed. Os dois valores servem somente
para exercitar a parametrização. Nenhuma constante de Pogo está definida neste pacote.

## 6. Vetores de teste
golden.json usa o schema cleanroom-golden/v1 e contém exatamente os cinco IDs abaixo.
Há cinco definições de caso, dez execuções previstas com os dois parâmetros e zero
execuções realizadas na referência. source identifica inspeção estática não executada.
Nenhum expected é nulo. O portão documental não executa os vetores nem prova equivalência.

| ID | direction_by_step | assertion_steps | transition_step |
| --- | --- | --- | --- |
| mov-parado-anda | 0, 1, 1, 1 | 1, 2, 3 | 1 |
| mov-solta | 1, 1, 0, 0 | 2, 3 | 2 |
| mov-vira-esq | 1, 1, -1, -1 | 2, 3 | 2 |
| mov-vira-dir | -1, -1, 1, 1 | 2, 3 | 2 |
| mov-max | 0, 1, 1, 0, -1, -1, 1, 0 | todos os oito | Não aplicável |

Todos os passos anteriores à transição são executados para preparar o estado; não são
substituídos por uma velocidade inicial inventada. O parâmetro não muda dentro do caso.
O runner deve validar finitude de todas as amostras e a relação direção/solicitação da seção 4
em todos os passos, além de avaliar cada campo de expected como segue:

| Asserção | Definição exata |
| --- | --- |
| velocity_sign | Todas as amostras de assertion_steps são estritamente positivas para 1 ou estritamente negativas para -1 |
| velocity_is_constant_after_input | Todas as amostras de assertion_steps são iguais entre si, incluindo a primeira após transition_step; sem período de aquecimento |
| velocity | Todas as amostras de assertion_steps são exatamente iguais ao valor indicado, zero no caso de soltura |
| sign_changed_immediately | Em transition_step o sinal já é o da nova direção, oposto ao da amostra anterior; a primeira amostra nova não é zero nem mantém o sinal anterior |
| velocity_lte_max_speed | Para cada amostra do caso inteiro, o valor absoluto de velocity é menor ou igual ao max_speed usado naquela execução |

velocity_lte_max_speed compara o MÓDULO, nunca somente o número assinado.
O sentido da asserção de constância inclui a amostra no próprio transition_step.
A palavra after identifica a solicitação após a entrada ser aceita, não o passo seguinte.
Resultado não finito, amostra ausente ou pré-condição violada não pode passar silenciosamente.
Violar pré-condição torna o ensaio inválido; violar uma asserção em ensaio válido é falha.

## 7. Incertezas
| ID | Incerteza | Tratamento |
| --- | --- | --- |
| U-011 | Máxima numérica original e configuração efetiva | Excluída; medir em jogo no 0.2.0 |
| U-012 | Frequência física, escala espacial e latência entre botão e direção aceita | Não inferir tempo real ou deslocamento; medir em execução |
| U-013 | Resposta física à parede, geometria e materiais | Fora de 0.1.1; medir no 0.2.0 |
| U-014 | Validade dinâmica das conclusões estáticas | Executar protocolos na referência completa |
| U-015 | Arbitragem de entradas simultâneas e efeitos de outros sistemas | Excluídos pelas precondições |
| U-016 | Versão comercial | Informação do usuário, não comprovada pelos metadados |

O inventário fornecido não contém dados locais de cena/configuração (EV-MOV-014).
Isso não afirma nada sobre outra instalação na máquina. Nenhum executável foi iniciado.
A sala limpa pode implementar somente este contrato parametrizado. Ambiguidade exige
pedido de esclarecimento; não preencher valores originais, colisões ou mecânicas excluídas.

## 8. Rastreabilidade
Todas as evidências abaixo estão vinculadas ao artefato sha256
70713bb2b1f1b0c4c6b7007fa6a8446cf79818cb5e308c48c094c4d1de7114bb.
Os IDs são resolvidos em registro mantido exclusivamente na sala de análise.

| Afirmação | Evidência | Tipo | Confiança | Data |
| --- | --- | --- | --- | --- |
| Identidade do artefato | EV-MOV-011 | Metadados e digest confrontados | Alta para identidade | 2026-10-31 |
| Direção direta, constância, soltura, inversão e limite condicional | EV-MOV-012 | Inspeção estática dirigida | Média | 2026-10-31 |
| Restrições do ramo e separação de estados especiais | EV-MOV-013 | Inspeção estática dirigida | Média | 2026-10-31 |
| Conteúdo local disponível e ausência de medições | EV-MOV-014 | Inventário local e registro da sessão | Alta para inventário | 2026-10-31 |

Bundle de evidências sha256:
edc54cff79d06989ae1c9cbb1ad1ff0f651ae54329d4c8705c521e97872c2a1a.
As conclusões anteriores EV-MOV-002 e EV-MOV-003 foram confrontadas nesta revisão.
Média significa interpretação do caminho estático selecionado, sem observação dinâmica.
Parâmetros, índices, nomes da interface e horizontes são escolhas de ensaio, não fatos da referência.

## 9. Declaração de independência
Declaro que esta spec não contém código, trechos de binário, dumps, assets,
nomes internos ou strings proprietárias. O comportamento foi descrito em linguagem própria.
Declaro que a evidência é estática e não representa execução da referência.
Somente spec, golden.json e manifesto atravessam para a sala limpa.
Evidências, notas e investigação de Pogo ficam na sala de análise.
A revisão permite testes do contrato horizontal parametrizado, dentro das exclusões declaradas.
Autor: agente da sala de análise. Data: 2026-10-31.
