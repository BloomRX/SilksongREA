# Fluxo passo a passo

Roteiro completo, do clone ao relatório de entrega. Exemplo com um alvo chamado
`meu-jogo`; troque pelo seu slug.

## Fase 0 — Preparar a máquina

```bash
git clone <este-repo> silksongrea
cd silksongrea
./scripts/bootstrap.sh
```

Saída esperada: Node OK, REA instalado, plano de setup aprovado, guards criados,
`isolamento OK`.

Se o `doctor` reclamar de provedor nativo, resolva **agora** (Ghidra é o caminho
mais simples). Sem provedor você ainda analisa JavaScript/Electron, .NET, Godot
PCK, UnityFS e containers.

## Fase 1 — Abrir o alvo

```bash
./scripts/new-target.sh meu-jogo --name "Nome do Jogo" --version "1.2.3"
cp -R /caminho/da/sua/copia targets/meu-jogo/analysis/artifacts/
./scripts/hash-artifacts.sh meu-jogo
```

Preencha `targets/meu-jogo/README.md`:

- pergunta de engenharia (uma frase);
- critério de sucesso;
- confirmações legais (posse da cópia, sem DRM, sem assets).

**Decisão de escopo.** Se a resposta para "o que eu quero" for "o jogo inteiro,
igual", pare e reduza: escolha **uma mecânica** ou **um formato**. Clean room
funciona por comportamento delimitado.

## Fase 2 — Análise

```bash
cd rooms/analysis
claude          # ou: codex
```

Prompt inicial (cole e ajuste):

```text
Leia AGENTS.md e a skill clean-room-spec.

Alvo: ../../targets/meu-jogo/analysis/artifacts (versão 1.2.3).
Pergunta: como o jogo decide <comportamento X>?

Faça:
1. reconhecimento do alvo (plataforma, engine, empacotamento) em
   ../../targets/meu-jogo/analysis/spec/notes/recon.md;
2. investigação dirigida com REA, uma hipótese por vez;
3. registre evidência (ID, tipo, digest) e exporte o bundle para analysis/evidence/;
4. preencha a spec comportamental e os vetores golden;
5. rode: node scripts/check-spec.mjs targets/meu-jogo/analysis/spec/spec.md --strict
   e corrija bloqueios.

Não escreva código de produto. Não copie strings, assets nem trechos de binário.
O que não foi observado vai para a seção 7 (Incertezas).
```

O agente deve produzir:

- `analysis/spec/notes/recon.md` — o mapa do alvo;
- `analysis/spec/spec.md` — 9 seções preenchidas;
- `analysis/golden/golden.json` — vetores com `id`, `input`, `expected`, `tolerance`;
- `analysis/evidence/*.json` — bundles (não vão para o handoff).

**Sinais de boa análise:** cada afirmação tem evidência; bordas aparecem; incertezas
estão explícitas; nada de nomes internos.

**Sinais de alerta:** "provavelmente", constantes sem origem, tabela de strings do
binário, descrição de função interna em vez de comportamento.

## Fase 3 — Revisão humana (5 minutos que economizam horas)

Leia a spec como se você fosse implementar **sem nunca ter visto o jogo**:

- [ ] Consigo escrever os testes só com `golden.json`?
- [ ] As bordas estão descritas (empate, zero, negativo, limite)?
- [ ] Cada número tem origem observável?
- [ ] Incertezas estão listadas, sem "achismos" disfarçados?
- [ ] A declaração de independência está assinada?

Se algo faltar, volte à sala de análise com um pedido objetivo.

## Fase 4 — Portão e handoff

```bash
node scripts/check-spec.mjs targets/meu-jogo/analysis/spec/spec.md --strict
./scripts/handoff.sh meu-jogo 0.1.0
```

O handoff cria `targets/meu-jogo/handoff/v0.1.0/` com `spec.md`, `golden.json` e
`manifest.json`, tudo em somente-leitura. O manifesto guarda hashes, autor, commit
do kit, hashes dos artefatos e a declaração.

Regra: **handoff é imutável**. Achou erro? Corrija a spec e gere `0.1.1`.

## Fase 5 — Implementação

Sessão **nova** e, de preferência, **outro agente**:

```bash
cd rooms/impl
claude          # ou: codex
```

Prompt:

```text
Leia AGENTS.md e a skill clean-room-impl.
Implemente ../../targets/meu-jogo/handoff/v0.1.0 em <linguagem/framework>.
Comece transformando cada caso de golden.json em um teste com o mesmo id.
Respeite as tolerâncias. Se a spec for ambígua, crie
../../targets/meu-jogo/analysis/requests/NNN-<tema>.md e siga no resto.
Registre em PROVENANCE.md qual seção da spec guiou cada arquivo/teste.
```

O guard bloqueia: `rea`, Ghidra/Hopper/JADX/Frida, leitura de `analysis/`, bundles
de evidência, busca ao REA na web. Se ele bloquear algo legítimo, **pare** e revise
— não contorne.

**Estrutura sugerida do projeto:**

```
meu-jogo-impl/
  src/
  tests/golden.test.*
  tests/edges.test.*
  PROVENANCE.md
  DELIVERY.md
```

## Fase 6 — Verificação

```bash
# no projeto da sala limpa
npm test            # ou o runner da sua stack

# na raiz do kit
./scripts/verify-isolation.sh meu-jogo
```

Critérios:

- 100% dos vetores passam;
- bordas e erros cobertos;
- nenhuma dependência do original;
- `PROVENANCE.md` completo;
- nenhum asset/string copiado.

## Fase 7 — Ciclo de correção

Nova informação sobre o alvo **só** entra por nova versão da spec:

```
sala limpa: pedido 001 → sala de análise: spec 0.1.1 + novos vetores
→ handoff 0.1.1 → sala limpa: diff de manifestos, testes novos
```

Comandos úteis:

```bash
diff <(jq -S . targets/meu-jogo/handoff/v0.1.0/manifest.json) \
     <(jq -S . targets/meu-jogo/handoff/v0.1.1/manifest.json)
./scripts/verify-isolation.sh meu-jogo
```

## Fase 8 — Entrega

O relatório da sala limpa (`DELIVERY.md`) deve ter:

- versão do handoff usada e hashes;
- vetores: passou/total;
- incertezas atendidas e pendentes;
- decisões de engenharia (spec → arquivo);
- declaração de que nenhum material do original foi acessado.

Junto com o `manifest.json` e o histórico Git, isso é sua trilha de auditoria.

## Usando Claude e Codex juntos

Sugestão que funciona bem:

| Sala | Agente | Por quê |
| --- | --- | --- |
| Análise | Claude Code | boa síntese de evidência e redação de spec |
| Implementação | Codex CLI | bom em TDD e código de produção |

Não é regra. O importante é **sessões e perfis separados** e **nenhum histórico
compartilhado** entre elas.

## Automação opcional

`make help` lista atalhos. Para rodar em CI:

```bash
make check TARGET=meu-jogo    # portão da spec + testes do kit
make verify TARGET=meu-jogo   # isolamento e integridade dos handoffs
```
