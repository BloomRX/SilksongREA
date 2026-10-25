# Relatório SilksongREA

**Execução:** `20261025T023917Z`  
**Início (UTC):** `2026-10-25T02:39:17.180Z`  
**Status geral:** ❌ FALHOU  
**Runtime detectado:** Unity Mono  
**Origem da detecção:** config-local

> Este é um relatório sanitizado. Código decompilado, CIL completo, inventário CSV, logs brutos e demais artefatos locais não são publicados.

## Resumo

- Arquivos inventariados: **2268** (7.6 GiB).
- Assemblies gerenciados encontrados: **152**.
- Decompilação ILSpy: **⏭️ IGNORADO**; 0 arquivos C# e 0 linhas locais.
- Etapas com falha: **1**; etapas com aviso: **1**.

## Etapas

| Etapa | Status | Duração | Observação |
|---|---|---:|---|
| Sincronização inicial do repositório | ✅ OK | 1.6 s | Branch atual sincronizada antes da análise. |
| Verificação das ferramentas | ✅ OK | 1.7 s | REA 6.7.0; 162 comandos detectados. |
| Localização e identificação do jogo | ✅ OK | 605 ms | Unity Mono; 152 assemblies gerenciados. |
| Inventário completo e hashes da build | ✅ OK | 957 ms | 2268 arquivos; 0 entradas ilegíveis. |
| Identidade de todos os assemblies .NET | ✅ OK | 6 min 56 s | 152/152 assemblies identificados; 0 com aviso. |
| Membros e CIL do Assembly-CSharp | ⚠️ AVISO | 4.6 s | Cobertura REA unavailable: Managed metadata exceeds the 67108864 byte representation budget |
| Tipos prioritários para mecânicas | ✅ OK | 5.0 s |  |
| Fronteiras nativas do código gerenciado | ✅ OK | 3.3 s |  |
| Recursos dos executáveis PE | ✅ OK | 5.4 s | 2/2 imagens PE examinadas; 0 com aviso. |
| Metadados IL2CPP (fallback) | ⏭️ IGNORADO | 0 ms | Nenhum global-metadata.dat encontrado; normal em uma instalação Mono. |
| Decompilação completa do Assembly-CSharp com ILSpy | ❌ FALHOU | 1 min 9 s | Falha ao instalar ilspycmd 11.1.0.9782: No NuGet sources are defined or enabled |
| Análise de Player.log | ⏭️ IGNORADO | 1 ms | Nenhum Player.log convencional encontrado. |

## Integridade dos arquivos principais

| Arquivo relativo | Tamanho | SHA-256 |
|---|---:|---|
| `Hollow Knight Silksong.exe` | 656.5 KiB | `5957b04989de6e242938f5ee0fc745a5b1af42da8cca44b0e6f8daf30d836496` |
| `Hollow Knight Silksong_Data/Managed/Assembly-CSharp.dll` | 6.7 MiB | `70713bb2b1f1b0c4c6b7007fa6a8446cf79818cb5e308c48c094c4d1de7114bb` |
| `UnityPlayer.dll` | 32.1 MiB | `5eadaec116a9810c68a3c67bc9ad07c6f233badeb06533987ce27deff471b21d` |

## Relatórios

- [Inventário resumido](files.md)
- [Análise gerenciada e decompilação](managed.md)
- [Cobertura e limitações](coverage.md)
- [Erros, avisos e Player.log](errors.md)
- [Resumo legível por máquina](summary.json)

## Onde estão os resultados completos

Somente no computador que executou a análise, em `.local/`. Esse diretório é ignorado pelo Git e pode conter material protegido do jogo. Não o envie para o repositório.
