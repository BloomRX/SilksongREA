# Exemplo: mecânica de mira assistida (fictícia)

Um ciclo completo de clean room em miniatura, sem nenhum material de terceiros.

```
pan-mechanic/
  spec.md              spec comportamental com as 9 seções (passa no portão)
  golden.json          7 vetores observáveis
  impl/
    solution.mjs       implementação independente (fictícia)
    solution.test.mjs  testes que consomem golden.json
```

## Rodar

```bash
# a spec passa no portão?
node scripts/check-spec.mjs examples/pan-mechanic/spec.md --strict

# a implementação passa nos vetores?
npm run verify:example
# ou
node --test examples/pan-mechanic/impl/solution.test.mjs
```

## O que observar

- `spec.md` descreve **decisões e bordas** (empate em 180°, zona morta, taxa zero)
  sem uma única linha de código.
- `golden.json` é o contrato executável: se a implementação muda de sinal no
  empate, `empate-180` quebra.
- `solution.mjs` cita a seção da spec em cada passo (`spec §4.2`).
- `solution.test.mjs` lê o JSON — uma nova versão da spec não exige reescrever
  testes.

## Usar como molde

```bash
./scripts/new-target.sh meu-alvo --name "Meu Alvo" --version "1.0.0"
# copie a estrutura de seções da spec e o formato do golden
```

O exemplo é deliberadamente pequeno: 1 página de spec, 7 vetores, ~40 linhas de
implementação. Se o seu primeiro alvo for muito maior que isso, reduza o escopo.
