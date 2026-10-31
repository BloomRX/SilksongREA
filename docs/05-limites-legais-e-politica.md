# Limites legais e política de uso

> **Isto não é aconselhamento jurídico.** É um resumo de engenharia para você fazer
> as perguntas certas ao seu advogado de propriedade intelectual. Leis variam por
> país e por contrato (EULA/ToS). Em caso de dúvida, não faça.

## 1. O que o clean room realmente compra

Clean room é, antes de tudo, **um argumento de criação independente**. Em disputa
sobre cópia de software, a pergunta central costuma ser se houve acesso e
reprodução da expressão protegida. Um processo bem documentado mostra:

- quem teve acesso ao original (só a sala de análise);
- o que atravessou (spec comportamental, sem código);
- como a implementação foi produzida (histórico, testes, decisões).

É por isso que o kit insiste em hashes, manifesto, log de auditoria e declaração
de independência. Sem registro, "fizemos clean room" é alegação sem prova.

Casos históricos famosos (ex.: BIOS compatível nos anos 1980) seguiram esse
desenho: um time estuda o comportamento, outro implementa a partir de uma
especificação funcional.

## 2. O que a lei protege (visão geral)

### Brasil

- **Lei 9.610/98 (Direitos Autorais)** — protege a **expressão**. O art. 8º exclui
  explicitamente ideias, procedimentos, sistemas, métodos e conceitos matemáticos
  "como tais". Ou seja: mecânica e método não são obra; a forma de expressar é.
- **Lei 9.609/98 (Programa de Computador)** — regime específico de software.
  O art. 6º lista o que **não** é ofensa, incluindo a semelhança que decorre de
  características funcionais da aplicação, de preceitos técnicos ou de limitação
  de formas alternativas de expressão. Isso favorece reimplementações funcionais,
  mas **não** é uma autorização geral para engenharia reversa.
- **Lei 9.279/96 (Propriedade Industrial)** — marcas, patentes e concorrência
  desleal. Nomes, logotipos e identidade visual do produto ficam aqui.
- **LGPD (Lei 13.709/18)** — dados pessoais; relevante ao analisar apps com contas,
  tráfego e telemetria.
- **Contratos** — EULA/ToS podem proibir engenharia reversa mesmo quando o direito
  autoral permitiria. Descumprir contrato gera risco próprio.

Não existe, no Brasil, uma exceção legal ampla e consolidada de engenharia reversa
equivalente à diretiva europeia de interoperabilidade. A prática de clean room
reduz risco; não elimina.

### Outras jurisdições (referência)

- **UE** — Diretiva de Software prevê descompilação para interoperabilidade em
  condições específicas.
- **EUA** — jurisprudência de uso justo (ex.: Sega v. Accolade, Google v. Oracle)
  e regras anticircunvenção (DMCA §1201), que tornam **contornar proteção técnica**
  um problema separado.

## 3. Linhas vermelhas do kit

O kit não foi feito — e você não deve usá-lo — para:

| Proibido | Exemplo |
| --- | --- |
| Contornar DRM, anti-cheat ou verificação de licença | descriptografar bundle, patch de ativação, bypass de servidor |
| Copiar expressão | sprites, áudio, textos, mapas, UI, nomes de personagens |
| Distribuir material do original | ROMs, assets, dumps, bundles, patches com dados do jogo |
| Violar privacidade | capturar sessões de terceiros, usar contas alheias |
| Fraude | replicar assinatura, gerar licenças, falsificar identidade |
| Quebrar contrato | automatizar app contra ToS, raspar dados |

## 4. Zona permitida (com cuidado)

- analisar software que você **possui** ou está autorizado a examinar;
- reimplementar **funcionalidade** (mecânica, cálculo, comportamento);
- documentar **formatos e protocolos** para interoperabilidade;
- preservação e pesquisa (ex.: estudar um jogo antigo que você possui);
- corrigir compatibilidade e acessibilidade;
- aprender engenharia reversa em alvos legais (CTFs, software próprio, open source).

## 5. Política prática deste repositório

| Regra | Onde é aplicada |
| --- | --- |
| Só comportamento atravessa | `scripts/check-spec.mjs` |
| Nada de código/dump/asset na spec | `scripts/check-spec.mjs` |
| Handoff imutável e com hashes | `scripts/handoff.sh` + `verify-handoff.mjs` |
| Sala limpa sem REA/alvo/análise | `scripts/guard-impl.mjs` + hooks |
| Trilha de auditoria | `targets/<slug>/analysis/audit/log.jsonl` |
| Proveniência dos artefatos | `scripts/hash-artifacts.sh` |
| Isolamento verificável | `scripts/verify-isolation.sh` |

Falta algo que nenhum script resolve: **julgamento**. Antes de cada alvo,
responda por escrito na ficha (`targets/<slug>/README.md`):

1. Por que tenho direito de analisar isto?
2. O resultado é funcionalidade ou cópia de expressão?
3. Vou distribuir o quê, e isso inclui material de terceiros?
4. O contrato que aceitei permite isso?

## 6. Evidências que ajudam numa discussão

Se um dia precisar demonstrar independência, você quer ter:

- data e hash do build analisado (`artifacts.sha256`);
- spec versionada com autoria e declaração assinada;
- manifesto do handoff com hashes e commit;
- log de auditoria contínuo;
- histórico Git das duas salas, sem commits cruzados;
- testes golden que reproduzem o comportamento declarado;
- registro de que a sala limpa não tinha acesso ao original;
- revisores humanos identificados.

O kit gera quase tudo isso automaticamente. O que ele não gera é **política
interna assinada** — se o projeto for comercial, escreva uma.

## 7. Checklist antes de publicar

- [ ] Nenhum asset do original no repositório ou no build.
- [ ] Nenhuma string proprietária (textos, nomes, diálogos).
- [ ] Nenhuma marca, logo ou personagem.
- [ ] Nenhum dado pessoal.
- [ ] Nenhum segredo (chaves, tokens) encontrado na análise.
- [ ] A funcionalidade implementada é descrita de forma genérica.
- [ ] O EULA do produto original não proíbe o que você fez.
- [ ] Existe registro do processo (handoff + auditoria).

## 8. Perguntas para o seu advogado

1. Reimplementar esta mecânica específica configura violação de expressão?
2. O EULA do produto permite análise e reimplementação?
3. Existe patente ou marca envolvida nesta funcionalidade/nome?
4. O que precisamos guardar como prova de criação independente?
5. Podemos distribuir a implementação e os testes? Com qual licença?
6. Há risco regulatório (dados, concorrência, consumidor) no setor?
