# Roteamento de alvos no REA

Regra geral: use `open_binary` para alvos nativos/arquivos; ferramentas
target-free para JavaScript, .NET, Android, IL2CPP e formatos de container.
Os nomes MCP usam `snake_case`; o CLI equivalente usa `kebab-case`
(`inspect_il2cpp_metadata` ↔ `rea inspect-il2cpp-metadata`).

## Diagnóstico antes de investigar

```bash
rea doctor --client claude_code --json     # ou: --client codex
rea doctor --skill --json                  # skill instalada
rea doctor --provider ghidra --json        # provedor nativo
```

- `missing` em instalação por **plugin**: verifique no cliente
  (`claude plugin list`, `/mcp`, `codex plugin list`) — não rode `rea setup`.
- `missing` em instalação por **setup**: `rea setup --client <id> --dry-run --json`
  e depois aplique o plano.
- Provider indisponível não impede análise estática de JavaScript nem inspeção de
  containers.

## Por tipo de alvo

| Alvo | Primeiro passo | Aprofundamento |
| --- | --- | --- |
| Binário nativo (exe/ELF/Mach-O/DLL) | `open_binary` + `binary_session` | pseudocódigo, assembly, strings, símbolos, chamadas, xrefs; snapshot para reuso |
| Unity IL2CPP | `inspect_il2cpp_metadata` com `global-metadata.dat` (+ `binary_path`) | liga métodos a endereços; depois análise nativa do binário |
| Unity AssetBundle (UnityFS) | `inspect-artifact` | `extract-artifact` para inventário; blocos LZ4; v9 não suportado |
| Godot PCK | `inspect-artifact` / `extract-artifact` | formatos 1–4; MD5 declarado ≠ sha256 observado |
| .NET gerenciado | `inspect_managed_artifact` | `compare-managed-members`, `project-managed-application-graph`, reconstrução gerenciada |
| Electron/ASAR/JS | `analyze_javascript_application` | `trace-application-feature`, `compare-application-versions`, `reconcile-javascript-runtime` |
| Android APK | `inspect_android_package` | `project-android-application-graph`; JADX para código |
| Apple (plist, assets, app) | `open_bundle_resources` | `project-apple-application-graph`; binário nativo via `open_binary` |
| Web | observação de navegador e capturas | rede/HAR, bundle e runtime JS |
| Firmware | `inspect_firmware_regions` | `extract_firmware` (Binwalk/Unblob no Linux) |
| WASM | inspeção de artefato | `compare-wasm-interfaces` |
| Emuladores/consoles (DOS, N64, PSP, PPC, MIPS) | Ghidra com o loader certo | ver docs do REA: `ghidra-dos`, `ghidra-dol`, `ghidra-psp`, `ghidra-ppc`, `ghidra-mips` |

## CLI útil

```bash
# binário nativo, com snapshot reutilizável
rea analyze /caminho/alvo --provider ghidra --snapshot /caminho/analysis/alvo.json --json

# aplicação JavaScript/Electron (não exige engine nativa)
npx -y rea-agents@latest analyze-javascript-application /caminho/app --json

# container (APK, UnityFS, PCK, ZIP…)
rea inspect-artifact /caminho/pacote --detail summary --evidence_output /caminho/ev.json --json
rea extract-artifact /caminho/pacote --json

# evidência
rea evidence-import bundle.json
rea evidence-export bundle.json canonical.json
rea compare left.json right.json --json
```

## Provedores nativos

- **Ghidra** — grátis, multiplataforma; o mais indicado para começar.
- **Hopper** — macOS e Linux x86_64; comercial (demo com limites).
- **IDA** — comercial, com bridge opcional.
- **Kuna** — alternativo, conforme docs.

Requisitos: Node 22.23.4+/24.22.1+/26.12.1+, e `ps` compatível com procps no Linux.

## Sinais de que você está no caminho errado

- Está lendo assembly para responder uma pergunta de **comportamento** que poderia
  ser respondida executando o alvo e medindo entradas/saídas.
- Está tentando abrir um alvo protegido por DRM/anti-cheat — **pare**; está fora
  do escopo do clean room.
- Está colando trechos de pseudocódigo nas notas da spec — reescreva como
  comportamento observável.
