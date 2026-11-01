# 12 · Medir em jogo

A inspeção estática entrega estrutura: tipos, campos, ramos, ordem das chamadas.
Ela **não** entrega os valores ajustados no editor — velocidade, aceleração,
tempo de recarga, dano, tolerância de colisão. Esses números vivem em assets
serializados (`resources.assets`, `sharedassets*`, ScriptableObjects, FSMs) ou
só existem em tempo de execução.

Sem medir, o vetor de teste fica qualitativo (`velocity_sign`,
`velocity_is_constant_after_input`). Isso é legítimo e às vezes suficiente — mas
não responde "quão rápido" nem "o que acontece na parede".

Este documento é o protocolo para transformar observação em número, **sem**
tocar no código do original.

---

## O que dá para medir assim

| Pergunta | Como se mede | Precisão típica |
| --- | --- | --- |
| Existe rampa de aceleração? | passo a passo nos quadros, procurada na solicitação | sim/não |
| Inversão é imediata? | passo a passo na troca de direção | sim/não |
| Velocidade máxima | deslocamento por quadro, normalizado pelo corpo | ±2–5 % |
| Tempo de recarga / cooldown | contagem de quadros entre eventos | ±1 quadro |
| Resposta a parede / teto | empurrar contra a superfície e amostrar | qualitativa |
| Tempo de subida/queda do pulo | altura por quadro | ±5 % |

## O que **não** se mede assim

- Latência entre apertar o botão e a direção ser aceita (o vídeo já entra depois).
- Taxa física interna (tick) — você vê quadros renderizados, não o tick.
- Valores que não mudam o que aparece na tela (flags internas, ordem de avaliação).

Se a spec depende de algo dessa lista, escreva como incerteza (`U-nnn`) em vez de
chutar.

---

## Protocolo A — captura

1. OBS (ou similar) gravando a **60 fps constante**, taxa alta ou sem perda,
   janela em resolução fixa (1080p), sem redimensionamento no meio.
2. Vsync ligado, sem motion blur, sem tremida de câmera, HUD fora do caminho ou
   anotado.
3. Área plana, sem inimigo, sem item, sem modificador, sem transição. Se houver
   variação de terreno, descarte o trecho.
4. Um clipe por medição, com sequência explícita: parado 5 s → segura direção 3 s →
   solta 2 s → inverte 2 s → corre contra a parede 3 s.
5. Nomeie o clipe com o ID do caso (`mov-max-01.mp4`) e guarde o SHA-256 em
   `targets/<slug>/analysis/evidence/`. **O vídeo não entra no Git** — entra o
   hash e o caminho.

## Protocolo B — deslocamento normalizado

Medir em pixel absoluto não serve: muda com a resolução e com o zoom da câmera.
Normalize pelo próprio personagem, em **corpos por segundo**.

1. Escolha um ponto do corpo fácil de repetir (pé esquerdo, centro da base).
2. Congele o quadro e anote a posição horizontal desse ponto no quadro `N`.
3. Avance `k` quadros (use 60–180) e anote a posição no quadro `N+k`. O mesmo
   ponto, não "o personagem".
4. `deslocamento_px = x2 - x1`.
5. Meça a **altura do corpo em pé** (base dos pés ao topo da cabeça) em pixels, na
   mesma gravação. Se o personagem tem hitbox conhecida visualmente, use-a; senão
   use a altura visual e diga que usou.
6. `velocidade = (deslocamento_px / altura_corpo_px) / (k / 60)` → **corpos/s**.

Com 180 quadros e erro de ±1 px em cada marca, o erro fica abaixo de 1 %; com 60
quadros, ~2 %. Some a isso a incerteza da altura do corpo (~2 %). Arredonde para
duas casas e declare a incerteza no vetor.

Repita o clipe 3 vezes em sentidos alternados (direita e esquerda). Se os módulos
diferem mais que a incerteza, há mais coisa no sistema — registre em `U-nnn`.

## Protocolo C — resposta a parede

1. Corra contra uma parede vertical reta, segurando a direção por 2 s.
2. Amostre a velocidade **enquanto há contato**: parado contra a parede, o valor
   vai a zero; deslizando, permanece.
3. Se o personagem "gruda" e escorrega devagar, é outro comportamento: registre
   separado, não dentro do caso de movimento normal.
4. Se o contato muda a velocidade antes de tocar (antecipação de borda), meça a
   distância em pixels do corpo até a parede no quadro em que a velocidade cai.

## Como o número entra no kit

- No `golden.json`, o `expected` recebe o número e um `tolerance` declarado:

```json
{
  "id": "mov-max",
  "input": { "direction_by_step": [0, 1, 1, 1], "frames": 4 },
  "expected": { "velocity": 6.4 },
  "tolerance": 0.3,
  "source": { "kind": "runtime_measurement", "clip_sha256": "…", "uncertainty": "±0.2" }
}
```

- `tolerance` é absoluto, na mesma unidade de `expected` (corpos/s, acima).
- O `source` diz **de onde veio**: `static_inspection_not_executed`,
  `runtime_measurement` ou `protocol_choice_not_original_measurements`. Nunca
  deixe implícito.
- Ao escrever a spec, diga a unidade e a incerteza na tabela de constantes (§5) —
  quem implementa precisa saber que "6.4 corpos/s" não é um número do original,
  é uma medida com margem.

## Limite legal e de sala limpa

- Gravar o seu próprio jogo e contar pixels é **observação**. É o caminho limpo.
- Ler o asset serializado para pegar o valor é ler dado do original — trate como
  contaminação: se acontecer, registre em `audit/` e mantenha o valor fora do texto
  da spec; use-o no máximo para conferir a sua medição.
- Nunca extraia e reutilize arte, som, animação, prefab, texto ou código do
  original. Medir comportamento é interoperabilidade; copiar conteúdo não é.

## Checklist

- [ ] 60 fps constantes, resolução fixa, sem blur, HUD anotado.
- [ ] Cena plana e limpa; trechos com interferência descartados.
- [ ] Um clipe por caso, com o nome do ID.
- [ ] 3 repetições alternando sentido; divergência acima da incerteza explicada.
- [ ] Deslocamento medido com o mesmo ponto do corpo, em 60–180 quadros.
- [ ] Normalização por altura do corpo declarada explicitamente.
- [ ] `expected` numérico + `tolerance` + `source` + incerteza na §5.
- [ ] SHA-256 do clipe no `evidence/`; vídeo fora do Git.
- [ ] Incertezas que sobraram viraram `U-nnn` na spec.
