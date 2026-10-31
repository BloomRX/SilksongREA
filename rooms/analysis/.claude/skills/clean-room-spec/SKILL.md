---
name: clean-room-spec
description: Produza a especificação comportamental de clean room de um jogo ou app usando o REA, com evidência rastreável e vetores de teste, sem copiar código, binário ou assets. Use quando estiver na sala de análise (rooms/analysis) investigando um alvo local para reimplementação independente.
metadata:
  version: "1"
---

# Spec de clean room

Você está na **sala de análise**. Seu entregável é comportamento observável,
rastreável e reproduzível — nunca implementação.

## Antes de começar

- Confirme que o alvo está em `targets/<slug>/analysis/artifacts/` e que o
  usuário tem direito de analisá-lo.
- Leia `targets/<slug>/README.md` (pergunta de engenharia e critério de sucesso).
- Abra `targets/<slug>/analysis/spec/spec.md` (template já criado).
- Confirme as ferramentas: se REA não aparecer, siga `references/rea-routing.md`.
  Não reinstale nada antes de diagnosticar (`rea doctor --client <id>`).

## Pipeline

### 1. Reconhecimento (sem conclusões ainda)

Descubra o que é o alvo e como ele se organiza:

- plataforma, engine/runtime, arquitetura, empacotamento;
- onde vive a lógica que interessa (camada de app, script, assembly gerenciado,
  código nativo, formato de arquivo);
- o que dá para observar por execução e o que só por leitura estática.

Anote em `analysis/spec/notes/recon.md`. Nada de conclusão sem evidência.

### 2. Investigação dirigida

Uma pergunta por vez, no ciclo: **hipótese → observação → conclusão → evidência**.

- Use as ferramentas certas para o tipo de alvo (`references/rea-routing.md`).
- Prefira **execução controlada** para comportamento (entrada → saída) e leitura
  estática apenas para localizar onde observar.
- Registre a evidência no momento em que ela aparece: ID, tipo, digest, data.
- Exporte o bundle de evidência para `analysis/evidence/` (fora do handoff).
- Marque confiança: `alta` (observado e reproduzido), `média` (observado uma vez),
  `baixa` (inferido de documentação) — e incertezas vão para a seção 7.

### 3. Redação da spec

Preencha as 9 seções do template. Regras editoriais:

- Descreva **decisões, entradas, saídas, estados e limites**, em linguagem natural.
- Nada de cercas de código (` ```c `, ` ```js ` …). JSON/texto puro é permitido
  para ilustrar entrada/saída.
- Nada de nomes internos do binário (`sub_`, `FUN_`, `vtable`, tipos do
  decompilador), nomes de ferramentas ou referência a decompilação.
- Constantes só entram se foram **observadas** — com o método de observação.
- Empates, divisão por zero, overflow e entradas inválidas são obrigatórios.
- O que não foi observado fica explícito em "Incertezas". Nunca preencha lacuna.

### 4. Vetores de teste (`golden.json`)

- Um caso por comportamento: `id`, `input`, `expected`, `tolerance` (se numérico).
- Inclua normal, bordas, erros e empates. Use casos que você executou.
- Casos derivados só de documentação devem ser marcados como tal no `source`.
- Não coloque dados proprietários (textos, nomes de personagens, assets) nos vetores.

### 5. Portão e handoff

```bash
node ../../scripts/check-spec.mjs ../../targets/<slug>/analysis/spec/spec.md --strict   # a partir de rooms/analysis
```

Corrija **BLOQUEIOS**; avalie cada aviso (endereço bruto, caminho de artefato,
extensão de código citada). Só então o operador roda:

```bash
./scripts/handoff.sh <slug> <versão>
```

Handoff é imutável. Achou erro depois? Corrija a spec e gere nova versão.

## Pedidos de esclarecimento

A sala limpa pergunta por escrito em `analysis/requests/`. Responda **na spec** e
com **novos vetores**. Nunca responda com código, trecho de binário ou detalhe de
implementação interna. Se for indefinido, documente o indefinido e o
comportamento esperado da implementação.

## Antipadrões (bloqueiam o processo)

| Antipadrão | Por quê |
| --- | --- |
| Colar pseudocódigo do decompilador na spec | contamina a implementação; vira obra derivada |
| "A função X faz Y" sem evidência | não é auditável |
| Constante "provavelmente 0.35" | suposição vira bug e risco jurídico |
| Listar strings do binário "para referência" | material protegido atravessando a sala |
| Escrever código de produto aqui | quebra o clean room (o guard bloqueia) |
| Entregar a pasta `evidence/` | evidência bruta não é spec |

## Referências

- `references/rea-routing.md` — qual ferramenta usar por tipo de alvo e como
  diagnosticar.
- `references/evidence-and-provenance.md` — como registrar e exportar evidência.
- `references/spec-quality.md` — checklist de qualidade e exemplos de redação.
