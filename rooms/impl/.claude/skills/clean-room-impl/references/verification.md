# Verificação na sala limpa

Objetivo: provar equivalência **sem tocar no original**.

## Pirâmide

1. **Vetores golden** — um teste por caso, mesmo `id`, mesma tolerância.
2. **Propriedades** — invariantes da spec (ex.: saída sempre em [0, 360), nunca
   ultrapassa o passo máximo, idempotência quando já está no alvo).
3. **Bordas e erros** — cada linha da tabela de bordas da spec vira teste.
4. **Regressão** — se a spec ganhar nova versão, diff de vetores e testes novos.

## Estrutura sugerida de testes

```
tests/
  golden.test.<ext>      # consome golden.json diretamente
  properties.test.<ext>  # invariantes
  edges.test.<ext>       # bordas e erros
```

O teste golden deve ler o JSON do handoff e iterar — assim uma nova versão da
spec não exige reescrever testes.

## Tolerância

- Numérico: use a tolerância declarada; se não houver, proponha uma e registre.
- Comparação de igualdade exata só quando a spec disser "exato".
- Tempo/performance: compare faixas, não valores instáveis.

## Anti-violação (checagem antes de entregar)

```bash
# histórico do projeto não pode citar/baixar o original
git log --all --oneline | head -50
grep -RIn --exclude-dir=.git -e "ghidra\|hopper\|il2cpp\|decompil" .

# dependências não podem apontar para o alvo
cat package.json 2>/dev/null || true
```

- Nenhum binário do original no repositório.
- Nenhuma URL do jogo/app, wiki interna ou repositório de mods.
- Nenhum asset exportado.

## Relatório de entrega

```markdown
# Entrega — <alvo> <handoff vX.Y.Z>

## Resultado
- Vetores: 7/7
- Bordas: 3/3
- Incertezas atendidas: 1 de 2

## Decisões
- <seção da spec> → <arquivo/teste> → <por quê>

## Pendências
- Pedido 001: aguardando definição de empate em 180°
```
