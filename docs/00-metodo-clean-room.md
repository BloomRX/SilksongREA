# Método: clean room para jogos e apps

## 1. O que é (e o que não é)

Clean room é um processo de engenharia em que **quem especifica não implementa** e
**quem implementa nunca vê o original**. A separação serve a dois objetivos:

1. **Técnico** — a implementação fica independente e testável por comportamento.
2. **Jurídico** — cria evidência de que a expressão do original não foi copiada.

Não é uma permissão geral para clonar produtos. Ideias, métodos e mecânicas não
são protegidos por direito autoral; **a forma de expressão é**. Clean room ataca
justamente o risco de a expressão vazar de um lado para o outro.

Também não é um selo: sem disciplina de registro, "clean room" é só um nome.

## 2. Papéis

| Papel | Onde fica | Responsabilidade |
| --- | --- | --- |
| **Analista** (sala suja) | `rooms/analysis` | observar comportamento, registrar evidência, escrever a spec |
| **Implementador** (sala limpa) | `rooms/impl` | implementar e testar a partir da spec |
| **Operador** | raiz do kit | rodar portão, handoff, auditoria, decidir conflitos |

Em projetos pequenos você pode ser os três — mas **em sessões separadas**, com
perfis/diretórios separados, e de preferência com **agentes/modelos diferentes**.
O que não pode é a mesma sessão ver o original e escrever a implementação.

## 3. O funil

```
alvo ──► observação ──► evidência ──► spec ──► handoff ──► implementação ──► testes
                                  │
                                  └── o que não foi observado vira incerteza,
                                      não suposição
```

Regras do funil:

- **Uma afirmação, uma evidência.** Se não tem evidência, é hipótese.
- **Nível de confiança explícito** (alta/média/baixa).
- **Incerteza não é problema** — problema é incerteza disfarçada de certeza.
- **Handoff é imutável.** Correção = nova versão (e novo manifesto).

## 4. Níveis de isolamento

Escolha o nível conforme o risco. O kit implementa L1/L2; L3 é infraestrutura.

### L1 — disciplina de sessão (fraco)

Duas pastas, duas sessões, guards ativos (`check-spec` + hooks).
Protege contra descuido, **não** contra intenção ou acesso via shell fora do hook.
Serve para estudo pessoal.

### L2 — perfis separados (médio)

Além de L1: `CLAUDE_CONFIG_DIR`/`CODEX_HOME` distintos, REA registrado só no perfil
de análise, sala limpa em outro usuário do SO ou container sem o material.

```bash
# perfil dedicado à análise, com REA
CLAUDE_CONFIG_DIR=~/.claude-rea npx rea-agents setup --client claude_code
CLAUDE_CONFIG_DIR=~/.claude-rea claude

# sala limpa: perfil sem REA
CLAUDE_CONFIG_DIR=~/.claude-impl claude
```

O próprio REA documenta que escopo de MCP/skill **não** é isolamento de clean
room: um agente no mesmo usuário pode rodar `rea` do PATH e ler outros perfis.
Por isso L2 ainda é organizacional.

### L3 — fronteira real (recomendado para uso comercial)

Máquina/VM/container separado para a sala limpa, com:

- apenas a pasta do handoff montada (somente leitura);
- nenhum acesso ao diretório do alvo, das evidências ou do REA;
- nenhum pacote/registro com o resultado da análise além do handoff.

Use `docker/impl/` como ponto de partida ou crie um usuário de SO dedicado com
permissões restritas. Só aqui a separação é **imposta**, não combinada.

## 5. O que costuma dar certo (e o que não dá)

### Bons alvos para clean room

- mecânicas e fórmulas (mira, dash, knockback, curva de dano, economia);
- regras de simulação e IA de comportamento geral;
- formatos de arquivo e protocolos (interoperabilidade);
- comportamento de UI e fluxos (sem copiar layout/ícones);
- correções de compatibilidade e preservação.

### Maus alvos (não tente "clonar")

- arte 2D/3D, animações, efeitos, áudio, dublagem, fontes;
- textos, diálogos, nomes de personagens, logotipos, ícones;
- mapas e level design como um todo;
- "o jogo inteiro, igualzinho" — isso não é clean room, é cópia.

Para assets, o caminho é **criar original** (ou licenciar). Referência de estilo é
discutível; cópia de expressão não é.

## 6. Por que a spec não pode ter código

Pseudocódigo de decompilação é **obra derivada** da expressão do original: se ele
atravessa, a implementação deixa de ser independente. Por isso o portão bloqueia:

- blocos de código em linguagens de programação;
- símbolos típicos de decompilador (`sub_`, `FUN_`, `vtable`, tipos internos);
- dumps hex/base64 e assets embutidos;
- nomes de ferramentas de engenharia reversa;
- declaração de independência ausente.

O que passa: linguagem natural, tabelas, contratos de entrada/saída e vetores em
JSON. É suficiente? Sim — veja `examples/pan-mechanic/`: uma spec de uma página
com 7 vetores gerou uma implementação independente que passa 10 testes.

## 7. Auditoria mínima

Para cada alvo, guarde:

- `analysis/artifacts.sha256` — o que foi analisado;
- `analysis/evidence/` — bundles exportados (fora do handoff);
- `analysis/spec/spec.md` + `golden/golden.json` — o que atravessou;
- `analysis/audit/log.jsonl` — eventos (criação, hashes, handoffs);
- `handoff/v*/manifest.json` — hashes, autoria, commit, declaração;
- `PROVENANCE.md` do lado da implementação — spec ↔ código/teste;
- histórico Git das duas salas.

`./scripts/verify-isolation.sh` recompõe os hashes e aponta violações.

## 8. Quando o processo quebra

| Sintoma | Causa provável | Correção |
| --- | --- | --- |
| spec com nomes internos | analista colou saída da ferramenta | reescrever como comportamento |
| implementação "sabe demais" | mesma sessão/perfil | refazer em sala limpa (L2/L3) |
| vetores não cobrem bordas | pressa | nova versão da spec com mais casos |
| retrabalho constante | spec ambígua | protocolo de pedido de esclarecimento |
| handoff adulterado | edição manual | gerar nova versão; nunca editar o selo |

## 9. Checklist de entrada

- [ ] Tenho o direito de analisar esta cópia?
- [ ] Sei exatamente qual build (hash) estou analisando?
- [ ] A pergunta é sobre comportamento, não sobre expressão?
- [ ] Vou criar meus próprios assets?
- [ ] O handoff e a implementação vão ficar em ambientes separados?
- [ ] Existe alguém para revisar a spec antes de liberar?
