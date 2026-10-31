# Evidência e proveniência

O que separa clean room de "achismo" é a cadeia: **afirmação → observação →
evidência → digest**. Sem isso, a spec não é auditável.

## O que registrar

Para cada observação relevante:

| Campo | Exemplo |
| --- | --- |
| ID | `EV-mira-004` (sequencial por tema) |
| Tipo | execução controlada, captura de rede, inspeção estática, documento |
| Alvo | slug + versão + sha256 do artefato |
| Entrada | parâmetros exatos usados |
| Saída observada | valor, tempo, mensagem visível |
| Limites | o que não foi coberto, ambiente, incerteza |
| Data | ISO-8601 UTC |

## Onde guardar

- `targets/<slug>/analysis/evidence/` — bundles exportados pelo REA (ignorados
  pelo Git).
- `targets/<slug>/analysis/spec/notes/` — notas internas. **Não vão para o handoff.**
- `targets/<slug>/analysis/audit/log.jsonl` — eventos do processo (criação, hashes,
  handoff). Append-only.

## Exportar bundle do REA

```bash
# MCP: use as ferramentas de bundle da sessão (família `session`) e salve o JSON.
# CLI: exporte/canonicalize o que já existe em disco.
rea evidence-export /caminho/bundle.json /caminho/analysis/evidence/bundle.json
rea evidence-import /caminho/analysis/evidence/bundle.json
```

Guarde também:
- `analysis/artifacts.sha256` (gerado por `./scripts/hash-artifacts.sh <slug>`);
- o commit do kit no momento da análise (o manifesto do handoff registra).

## Como citar na spec

Na seção 8, uma linha por afirmação relevante:

```
| Seção 4, passo 3 | EV-mira-004 | execução controlada | 2026-10-31 |
```

E no texto, quando fizer sentido: `(ver EV-mira-004)`.

## O que nunca atravessa para o handoff

- bundles de evidência e snapshots;
- nomes de arquivos/funções/strings do binário;
- offsets e endereços (exceto quando forem **formato público** e observável);
- hashes de assets (não são comportamento);
- qualquer coisa que identifique a implementação original.

O manifesto do handoff lista o que ficou de fora — mantenha essa lista honesta.

## Integridade

- Handoff é selado em somente-leitura e tem hashes no `manifest.json`.
- `./scripts/verify-isolation.sh` recomputa e compara.
- Se precisar corrigir algo depois do selo, gere **nova versão** (`0.1.1`), nunca
  edite o diretório antigo.
- Registre no `audit/log.jsonl` toda exportação e correção relevante.
