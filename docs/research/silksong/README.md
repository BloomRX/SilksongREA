# Silksong → Hack Overdrive: pesquisa do controlador

Sessão: 25/10/2026. Escopo: estudo estático de input, movimento horizontal, pulo e aterrissagem; dash e parede apenas como fronteiras de integração. Nenhuma implementação de gameplay foi criada.

**OBSERVADO — divisão de responsabilidades confirmada pelo usuário:** este trabalho fica restrito ao estudo de Silksong e às propostas derivadas das evidências. Claude Code será responsável pela execução no projeto de destino e pelo tratamento das escolhas de engine e jogabilidade. As alternativas Godot registradas são material de referência para ele, não requisitos aprovados nem perguntas que bloqueiam esta pesquisa.

## Resultado executivo

- **OBSERVADO:** o caminho normal filtra o eixo horizontal e atribui velocidade, com exceções para ações, superfícies e impulsos. Não foi encontrado um acelerador horizontal nesse caminho específico.
- **OBSERVADO:** pulo combina preparação, manutenção da velocidade vertical por passos e cancelamento ao soltar, sujeito a condições. Há filas no input e no controlador, além de tolerância de borda.
- **OBSERVADO:** a representação combina enum, flags e comunicação com PlayMaker; o controlador também coordena animação, colisão, áudio, progressão e transições de cena.
- **INFERIDO:** o principal aprendizado reutilizável é explicitar quem pode comandar o movimento, quando um comando expira e o que cada interrupção limpa.
- **PROPOSTA GODOT:** um controlador pequeno, com estado explícito, captura de comandos, perfil de movimento e apresentação separada. Não reproduzir a estrutura nem os valores do jogo.
- **PENDENTE:** validar sensação, duração efetiva, prioridades em casos simultâneos e parâmetros serializados em runtime.

## Índice

- [Controlador: evidências e dependências](character_controller.md)
- [Proposta independente, parâmetros e testes](godot_proposal.md)
- [Perguntas e próximos passos priorizados](open_questions.md)
- [Decisões e propostas ainda não aprovadas](decisions.md)

## Origem e reconhecimento

**OBSERVADO:** repositório confirmado antes da escrita por `git rev-parse --show-toplevel`, remoto `BloomRX/SilksongREA` e branch `arena/d5686468-silksongrea`. HEAD inicial: `58019f8`. A árvore estava limpa. Não foram encontrados arquivos AGENTS.md aplicáveis neste checkout. Não havia documentação anterior em `docs/research/silksong`.

**OBSERVADO:** os relatórios existentes descrevem inventário, ferramentas e cobertura; não apresentam um estudo comportamental do controlador. Esta sessão os usa como índice, sem repetir a decompilação.

**OBSERVADO:** o usuário confirmou que Hack Overdrive ainda não existe. Os projetos Godot encontrados em outros diretórios não foram tratados como destino. Versão, linguagem e estrutura de Hack Overdrive estão indefinidas. A documentação fica no repositório de pesquisa, sem alterações em projetos Godot.

| Fonte examinada | Uso / limite |
|---|---|
| [README do repositório](../../../README.md) | **OBSERVADO:** fluxo, diretórios locais e limites de publicação. |
| [Índice dos relatórios](../../../reports/README.md) | **OBSERVADO:** separação entre resumos e resultados brutos. |
| [Execução atual](../../../reports/latest/README.md) | **OBSERVADO:** execução `20261025T031201Z`, Mono, 152 assemblies, decompilação concluída. |
| [Inventário](../../../reports/latest/files.md) | **OBSERVADO:** layout e hashes; sem conteúdo de assets. |
| [Gerenciado](../../../reports/latest/managed.md) | **OBSERVADO:** seis tipos prioritários encontrados; índice da decompilação. |
| [Cobertura](../../../reports/latest/coverage.md), [avisos](../../../reports/latest/errors.md) | **OBSERVADO:** inspeção geral indisponível por orçamento de representação; sem Player.log. |
| `scripts/run-analysis.mjs`, `package.json`, `.gitignore` | **OBSERVADO:** destino local da decompilação, comandos e exclusões. Scripts não executados nesta sessão. |
| Fontes locais listadas no estudo | **OBSERVADO:** leitura focalizada; não foram copiadas para estes documentos. |

**OBSERVADO:** referência de build registrada no relatório: SHA-256 de `Assembly-CSharp.dll` = `70713bb2b1f1b0c4c6b7007fa6a8446cf79818cb5e308c48c094c4d1de7114bb`. É a identificação da execução anterior; esta sessão não revalidou o hash da instalação nem garantiu que ela permaneceu nessa build.

## Reprodução local e plano focalizado

**OBSERVADO:** a raiz de fontes foi localizada pela estrutura existente e confirmada no script: `.local/decompiled/Assembly-CSharp/`. Ela é ignorada pelo Git. O REA focado anterior está em `.local/runs/20261025T031201Z/raw/rea/assembly-csharp-members-focused.json`; sua existência foi verificada, mas seu conteúdo não foi usado como evidência de comportamento nesta sessão.

**PROPOSTA GODOT — método de estudo reutilizável:** ler os relatórios; confirmar os seis arquivos prioritários; localizar métodos por nome; seguir uma ação verticalmente; registrar efeitos e bloqueios; parar antes de investigar mecânicas laterais. Foi aplicado a movimento/pulo/aterrissagem. Para repetir, use `rg -n` nos arquivos e símbolos da tabela de evidências. As linhas são localizadores desta decompilação, não identificadores permanentes.

## Limites e preservação

- **OBSERVADO:** não houve execução do jogo, instrumentação, leitura de saves, extração de assets ou nova análise automatizada. Apenas documentação foi adicionada. O usuário autorizou commit e push dos estudos sanitizados para consulta posterior pelo Claude Code.
- **PENDENTE:** prefabs, cenas, materiais de física, valores serializados e grafos PlayMaker não foram examinados. Declarações públicas e inicializadores não provam valores usados pela instância.
- **PENDENTE:** a ordem entre scripts, render e física, contatos reais e caminhos efetivamente alcançados precisam de teste. Código descompilado pode conter artefatos; nomes não provam comportamento.
- **PENDENTE:** a documentação acompanha `reports/latest`, que é substituído pelo pipeline. Reproduções futuras devem conferir execução e hash acima ou consultar o histórico Git.

## Convenção das conclusões

**OBSERVADO:** evidência direta na fonte indicada, aqui predominantemente estática; não significa comportamento presenciado em jogo. **INFERIDO:** interpretação apoiada por evidências. **HIPÓTESE:** explicação ainda não confirmada. **PROPOSTA GODOT:** design original sugerido. **PENDENTE:** informação ou decisão ausente. Nenhuma proposta arquitetural é aprovação do usuário.
