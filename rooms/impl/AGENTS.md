# Sala de implementação (sala limpa)

Você implementa uma versão **independente** a partir de uma especificação
comportamental. Você não vê o original, não vê o REA e não vê a análise.

## Regra de ouro

> A spec é sua única fonte de verdade. Se ela não responde, você **pergunta** —
> não deduz, não busca o original, não reproduz o que você "lembra" do produto.

## Pode / não pode

| Pode | Não pode |
| --- | --- |
| Ler `targets/<slug>/handoff/v*/` (spec, golden, manifest) | Ler `targets/<slug>/analysis/` |
| Escrever código e testes no seu projeto | Rodar/instalar REA, Ghidra, Hopper, JADX, Frida |
| Usar bibliotecas e ferramentas normais de desenvolvimento | Abrir o app/jogo original, baixar seus arquivos ou decompilar |
| Criar arte/áudio/texto **originais** | Copiar assets, nomes, personagens ou marcas |
| Pedir esclarecimento por escrito | Inventar comportamento em caso de ambiguidade |

O guard da sala bloqueia comandos e caminhos proibidos. Se ele bloquear algo que
você acha legítimo, pare e peça revisão humana — não tente contornar o hook.

## Fluxo

1. **Leia o handoff inteiro** (`spec.md`, `golden.json`, `manifest.json`).
   Confira `./scripts/verify-isolation.sh <slug>` antes de começar.
2. **Traduza a spec em testes primeiro.** Cada caso de `golden.json` vira um teste
   com o mesmo `id`. Testes que falham são o seu roteiro.
3. **Implemente o mínimo** que satisfaz contrato, invariantes e bordas descritas.
4. **Rode os testes** a cada passo. Nada de "quase igual": respeite `tolerance`.
5. **Ambiguidade** → crie `requests/NNN-<tema>.md` **fora** da pasta do handoff
   (ex.: `requests/` no seu projeto) e pare aquela parte. Não preencha lacuna com
   suposição. Modelo em `clean-room-impl/references/ambiguity-protocol.md`.
6. **Registre proveniência**: use `templates/PROVENANCE.md` como molde e mantenha
   `PROVENANCE.md` com seção da spec → arquivo/teste.
7. **Verifique**: todos os vetores passam, sem dependência do original, sem asset
   copiado. Rode `node scripts/check-spec.mjs` do handoff não é necessário; o
   manifesto já foi validado. Foque nos testes do seu projeto.
8. **Entregue com relatório**: o que passou, o que ficou como incerteza, pedidos
   abertos.

## Definição de pronto

- [ ] 100% dos casos de `golden.json` passam (com tolerância declarada).
- [ ] Bordas e erros da spec têm teste.
- [ ] Nenhuma string, asset, número mágico sem justificativa ou estrutura copiada.
- [ ] Nenhum acesso ao alvo, ao REA ou à análise no histórico do projeto.
- [ ] `PROVENANCE.md` liga spec ↔ código/testes (`templates/PROVENANCE.md`).
- [ ] `DELIVERY.md` escrito (`templates/DELIVERY.md`).
- [ ] Pedidos de esclarecimento aberto estão listados (ou resolvidos).

## Skills disponíveis

- `clean-room-impl` — procedimento, verificação e protocolo de ambiguidade.

Método completo: `docs/00-metodo-clean-room.md`; verificação: `docs/06-verificacao-e-auditoria.md`.
