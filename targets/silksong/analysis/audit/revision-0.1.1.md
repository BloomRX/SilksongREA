# Auditoria da revisão 0.1.1 — 2026-10-31

Escopo fechado: mov-parado-anda, mov-solta, mov-vira-esq, mov-vira-dir, mov-max. Invariantes: sinal e constância desde a primeira solicitação, soltura exatamente zero, inversão na mesma avaliação, módulo menor ou igual ao parâmetro max_speed. Confiança média, inspeção estática dirigida; zero execuções da referência.

Exclusões: parede e máxima original, para medição em jogo no 0.2.0; física posterior, latência de entrada e estados especiais, por falta de observação. Pogo investigado e documentado separadamente como spec parcial; elegibilidade, configuração e resultado dinâmico ainda não fechados.

O handoff 0.1.0 é imutável. Hashes prévios: golden.json 929476c9a821fd1c9b9fbcfb2568547f0cc3817fa763ace1c614c78e76b2fb40; manifest.json 3d98e6093b1c80e10e7b197b7e5dff4f57e78458b79288a4df183fe9899df847; spec.md b524b7e255a069c9902eb32686081f7f3e31d6bd997fac8e048073d119d2d940.

Divergência encontrada: nesta cópia, scripts/handoff.sh valida apenas cases/id/input e não rejeita expected nulo. Não há check-golden no diretório de scripts. Nenhum script foi alterado. A revisão aplica a exigência mais forte do pedido por validação documental adicional de expected, cinco IDs e formato dos ensaios. Não foi usada opção de handoff parcial.

Os dois documentos passaram check-spec --strict sem avisos. A aprovação do portão é estrutural, não execução dos casos. O registro seal-verification.json documentará integridade, somente-leitura e comparação de 0.1.0 após o selo.
