# Cobertura e limitações

| Área | Status nesta execução | Limite conhecido |
|---|---|---|
| Inventário de arquivos e tamanhos | ✅ OK | Metadados do layout; o conteúdo dos assets não é extraído. |
| SHA-256 dos arquivos principais | ✅ OK | Usado para identificar exatamente a build analisada. |
| Identidade de todos os assemblies .NET | ✅ OK | Somente arquivos admitidos pelo parser do REA. |
| Membros/CIL do Assembly-CSharp | ✅ OK | Saída completa local; o resumo público não contém corpos. |
| Fronteiras nativas gerenciadas | ✅ OK | P/Invoke e indicadores de implementação nativa, quando suportados. |
| Decompilação C# com ILSpy | ❌ FALHOU | Saída completa somente local. |
| Recursos PE | ✅ OK | Apenas comandos existentes no REA publicado; não equivale a descompilação nativa. |
| Metadados IL2CPP | ⏭️ IGNORADO | Executado apenas quando um alvo IL2CPP é encontrado. |
| Player.log | ⏭️ IGNORADO | Somente caminhos convencionais; trechos limitados e sanitizados. |
| Publicação Git | ↻ AO FINAL | Somente reports/latest; nunca git add -A. |

## Fora do modo automático

- **PlayMaker/FSM ao vivo:** requer instrumentação ou inspeção em execução; o pipeline não injeta mods nem inicia o jogo.
- **Cenas, prefabs e assets renderizáveis:** há inventário, mas não exportação com AssetRipper.
- **Descompilação nativa profunda:** requer Ghidra, IDA ou Hopper e uma investigação separada.
- **Comportamento dinâmico:** valores reais de física, timers e transições precisam de confirmação em runtime.
- **Reconstrução Godot:** nenhuma mecânica é considerada reproduzida apenas porque o código foi lido.

Uma etapa ignorada ou indisponível nunca deve ser interpretada como prova de que o recurso não existe no jogo.
