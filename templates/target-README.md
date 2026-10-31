# Alvo: {{NAME}}

- Nome: {{NAME}}
- Slug: {{SLUG}}
- Versão analisada: {{VERSION}}
- Criado em: {{DATE}}

## Ficha de entrada (preencha antes de analisar)

- [ ] Tenho licença/posse legal desta cópia e ela foi obtida por meios legítimos.
- [ ] Sei qual build estou analisando (versão + hash em `analysis/artifacts.sha256`).
- [ ] A pergunta de engenharia está escrita abaixo, em uma frase.
- [ ] O objetivo é comportamento/mecânica/interoperabilidade — não copiar arte,
      áudio, textos, mapas, personagens, nomes ou marcas.
- [ ] Não vou contornar DRM, anti-cheat ou verificação de licença.
- [ ] O resultado será uma implementação independente, a partir da spec.

**Pergunta de engenharia:** (ex.: "como o jogo calcula a janela de esquiva do
personagem, para eu reimplementar uma mecânica equivalente com arte própria?")

**Critério de sucesso:** (ex.: "N vetores de teste batem; comportamento de borda
documentado; nenhum trecho do original reproduzido".)

## Estrutura

```
analysis/
  artifacts/    sua cópia do alvo (ignorada pelo Git)
  evidence/     bundles exportados pelo REA (ignorados pelo Git)
  spec/spec.md  a única coisa que sai daqui
  golden/       vetores de teste observáveis
  requests/     pedidos de esclarecimento vindos da sala limpa
  audit/        log de eventos do processo
handoff/        pacotes selados por versão (spec + vetores + manifesto)
```

## Estado

| Etapa | Responsável | Estado | Data |
| --- | --- | --- | --- |
| Entrada / escopo | | pendente | |
| Reconhecimento | | pendente | |
| Spec comportamental | | pendente | |
| Portão (`check-spec`) | | pendente | |
| Handoff selado | | pendente | |
| Implementação | | pendente | |
| Verificação diferencial | | pendente | |

## Diário

- {{DATE}} — alvo criado.
