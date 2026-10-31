# Verificação e auditoria

Duas perguntas diferentes:

1. **Equivalência** — minha implementação se comporta como a spec diz?
2. **Independência** — a implementação foi feita sem acesso ao original?

O kit automatiza parte das duas; o resto é disciplina e revisão humana.

---

## 1. Provar equivalência (lado da sala limpa)

### 1.1 Vetores golden

Cada caso de `golden.json` vira um teste com o mesmo `id`:

```json
{ "id": "wrap-horario", "input": {...}, "expected": 359, "tolerance": 1e-6 }
```

Regras:

- teste lê o JSON do handoff (não copie os valores para dentro do teste);
- compare com tolerância declarada; se não houver, proponha e registre;
- falha = bug ou spec incompleta; **nunca** ajuste o esperado para passar.

### 1.2 Propriedades

Além dos vetores, teste invariantes da spec:

- faixa de saída (`[0, 360)`, `>= 0`, etc.);
- monotonicidade ("nunca passa do alvo");
- idempotência ("se já está no alvo, não gira");
- conservação ("soma dos deltas = delta total").

Propriedades pegam bugs que os vetores não cobrem.

### 1.3 Bordas e erros

Cada linha da tabela de bordas da spec precisa de teste. Erros observáveis
(mensagens, códigos) também — sem copiar textos proprietários; use o significado.

### 1.4 Fuzz dentro do contrato

Gere entradas aleatórias **dentro das faixas da spec** e verifique só as
invariantes (não há oráculo do original). Isso encontra divisão por zero,
overflow e `NaN` sem precisar do alvo.

### 1.5 O que não é prova

- "passou nos 7 vetores" com bordas não testadas;
- tolerância frouxa que esconde erro de sinal;
- teste que importa o código do original (impossível na sala limpa, mas alguém
  pode tentar trazer um fixture);
- comparação visual de UI — não é comportamento mensurável sem critério.

---

## 2. Provar independência (lado do processo)

### 2.1 Antes do handoff

```bash
./scripts/verify-isolation.sh <slug>
node scripts/check-spec.mjs targets/<slug>/analysis/spec/spec.md --strict
```

O portão verifica material proibido; o verificador confere hooks, symlinks e
integridade dos handoffs.

### 2.2 No handoff

O `manifest.json` registra:

- versão, data, autor, branch e commit do kit;
- sha256 de `spec.md` e `golden.json`;
- hashes dos artefatos analisados;
- resultado do portão (erros/avisos);
- declaração de independência extraída da spec.

Qualquer edição posterior é detectada:

```bash
node scripts/verify-handoff.mjs targets/<slug>/handoff/v0.1.0/manifest.json
```

### 2.3 Na sala limpa

- hook ativo (bloqueia REA, alvo, análise, web do REA);
- histórico Git sem arquivos do original;
- `PROVENANCE.md` ligando spec → código/teste;
- nenhum asset binário no repositório;
- nenhuma URL/wiki do produto nas dependências ou comentários.

### 2.4 No ambiente

Para uso comercial, o nível L3 (container/VM/usuário separado) é o único que
**impõe** a separação. Os hooks são dissuasão. Ver `docs/00-metodo-clean-room.md`.

---

## 3. Trilha de auditoria

| Artefato | O que prova |
| --- | --- |
| `analysis/artifacts.sha256` | qual build foi analisado |
| `analysis/evidence/` | o que foi observado (não atravessa) |
| `analysis/spec/spec.md` | o que foi especificado |
| `analysis/golden/golden.json` | o que foi medido |
| `analysis/audit/log.jsonl` | quando cada evento ocorreu |
| `handoff/v*/manifest.json` | o que atravessou, com hashes |
| `rooms/impl/PROVENANCE.md` | como a spec guiou o código |
| histórico Git das salas | quem escreveu o quê, quando |

### Formato do log

Uma linha JSON por evento, append-only:

```json
{"at":"2026-10-31T12:00:00Z","event":"handoff","version":"v0.1.0","dir":"handoff/v0.1.0","spec_sha256":"…"}
```

Não edite linhas antigas. Se precisar corrigir, acrescente um evento novo.

---

## 4. Perguntas que um auditor faria

1. Quem teve acesso ao binário? Quando?
2. O que exatamente atravessou para quem implementou?
3. A spec contém alguma expressão do original?
4. Como você sabe que a implementação não foi copiada?
5. Os vetores de teste vêm de observação ou foram inventados?
6. Como você trata comportamento não observado?
7. Quem revisou e aprovou a spec?
8. Onde está o registro de que a sala limpa estava isolada?

Se todas tiverem resposta documentada, você tem um processo defensável — o mérito
jurídico continua sendo do advogado.

---

## 5. Checklist de fechamento

**Análise**

- [ ] ficha do alvo preenchida (direito de análise, escopo, critério)
- [ ] hashes dos artefatos registrados
- [ ] spec com 9 seções, sem material proibido
- [ ] vetores com normal, bordas, erros e empate
- [ ] incertezas explícitas
- [ ] declaração de independência assinada
- [ ] portão passou (sem bloqueios; avisos resolvidos ou justificados)
- [ ] handoff selado e verificado

**Implementação**

- [ ] 100% dos vetores passam
- [ ] propriedades e bordas cobertas
- [ ] `PROVENANCE.md` completo
- [ ] nenhum asset/string/segredo copiado
- [ ] nenhum acesso ao original no histórico
- [ ] `DELIVERY.md` com pendências e incertezas
- [ ] isolamento verificado no ambiente final

---

## 6. Métricas úteis (sem virar burocracia)

- **cobertura de comportamento**: vetores por borda declarada (alvo: 1+);
- **confiança**: proporção de afirmações com evidência de execução;
- **retrabalho**: pedidos de esclarecimento por versão de handoff (muitos = spec
  fraca; zero em comportamento complexo = suspeito);
- **tempo de portão**: se o portão bloqueia muito, o analista está colando
  material em vez de descrever comportamento.
