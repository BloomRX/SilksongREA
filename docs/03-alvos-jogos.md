# Alvos: jogos

Como rotear a análise por engine/empacotamento e como transformar isso em
comportamento reimplementável.

**Comece pelo detector:** `./scripts/detect-target.sh <slug>` identifica Unity
Mono/IL2CPP, UnityFS, Godot PCK, ROMs, WASM e nativo, e já sugere a ferramenta
inicial, o provedor e as famílias de ferramentas. As seções abaixo aprofundam
cada caso.

## Regra de ouro para jogos

O que se reimplementa é **regra**, não **conteúdo**. Fórmula de dano, janela de
esquiva, aceleração, curva de IA, economia, formato de save: sim. Sprite, música,
mapa, diálogo, personagem: não.

E: **não contorne anti-cheat**. Se o jogo tem anti-cheat ativo, não instrumente o
processo — trabalhe só com análise estática dos arquivos que você possui.

---

## Unity

Primeiro descubra se o build é **Mono** ou **IL2CPP**: procure
`*_Data/Managed/Assembly-CSharp.dll` (Mono) ou
`*_Data/il2cpp_data/Metadata/global-metadata.dat` + `GameAssembly.dll` (IL2CPP).

### Mono (gerenciado)

| Passo | Ferramenta |
| --- | --- |
| Inventariar assemblies | `inspect_managed_artifact` |
| Comparar builds | `compare-managed-members` |
| Grafo da aplicação | `project-managed-application-graph` |
| Reconstrução gerenciada | `import-managed-reconstruction` |

Não precisa de engine nativa. Ótimo ponto de partida: código gerenciado é legível
e o comportamento fica explícito — **mas lembre que ler o código do original é
justamente o que contamina a spec**. Use para **entender**, e registre apenas o
comportamento observável.

### IL2CPP

| Passo | Ferramenta |
| --- | --- |
| Decodificar metadados | `inspect_il2cpp_metadata` (`path` = `global-metadata.dat`) |
| Ligar métodos a endereços | mesma ferramenta + `binary_path` (`GameAssembly.dll`/`libil2cpp.so`) |
| Ver código de um método | `open_binary` no binário + provedor (Ghidra) |
| Ver literais de string | saída do `inspect_il2cpp_metadata` (não copie strings para a spec!) |

Versões de metadados suportadas: **24, 27, 29, 31 e 39** (Unity 2019.4 → 6000.4).
Outras versões são recusadas.

Ordem prática:

1. metadata → nomes de tipos/métodos e endereços;
2. escolha **um** método relevante para a pergunta;
3. abra o binário no provedor e leia o suficiente para **entender o comportamento**;
4. **descreva o comportamento** na spec (sem colar assembly, sem nomes internos);
5. gere vetores executando o jogo e medindo entradas/saídas.

### AssetBundles (UnityFS)

`inspect-artifact` / `extract-artifact`:

- formatos de header 6–8 suportados; **v9 não**;
- compressão none/LZ4/LZ4HC; **LZMA** e tabelas de blocos não suportadas;
- bundles com criptografia declarada: cabeçalho legível, diretório **desconhecido**
  (o REA não descriptografa — e você não deve tentar).

Extrair assets serve para **entender formato e estrutura**, não para reutilizar
arte. Nada de asset no handoff.

---

## Godot

`inspect-artifact` / `extract-artifact` em `.pck`:

- formatos 1–4 (Godot 3.5 a 4.7 verificados);
- PCK embutido no executável é localizado pelo trailer;
- MD5 declarado é do container; o REA também calcula sha256 do que leu.

Dentro do PCK você encontra cenas, scripts e recursos. Scripts podem estar em
texto (`.gd`) ou compilados. Para comportamento, prefira **observar execução**:
entradas, física, tempos, respostas da UI.

---

## Unity/Godot/outros: o que perguntar

| Pergunta de engenharia | Onde costuma estar | Como observar |
| --- | --- | --- |
| fórmula de dano/vida | scripts/assembly | variar entradas em ambiente controlado, medir resultados |
| janela de invencibilidade | código de estado do jogador | testar frames de dano consecutivos |
| aceleração/atrito | física | medir deslocamento por passo de tempo |
| RNG e distribuição | script de loot/IA | amostrar muitas execuções e estimar distribuição |
| buffer de input (coyote time) | controlador | variar 1 frame e ver quando a ação é aceita |
| hitbox/hurtbox | colisão | frame data com alvo em posições distintas |
| economia e progressão | script de dados | variar quantidades e observar custos/recompensas |
| formato de save | arquivo de save | criar saves controlados e comparar bytes |

---

## Jogos nativos (C/C++)

```bash
rea analyze /caminho/do/jogo --provider ghidra --snapshot ./analysis/snapshot.json --json
```

Arquiteturas e plataformas com guias próprios no REA:

| Plataforma | Guia do REA |
| --- | --- |
| DOS 16-bit | `ghidra-dos` |
| Nintendo 64 (DOL) | `ghidra-dol` |
| PSP | `ghidra-psp` |
| PowerPC (GC/Wii) | `ghidra-ppc` |
| MIPS | `ghidra-mips` |
| RISC-V | `ghidra-riscv` |
| iNES/NES (container) | `ines-containers` |

Snapshots evitam reiniciar o provedor a cada pergunta e tornam a análise
reproduzível — guarde o snapshot junto da evidência (não no handoff).

---

## Jogos web / WASM

- Web: ferramentas de observação de navegador, captura de rede e runtime JS
  (famílias `browser`, `pcap`, `javascript-runtime`).
- WASM: `wasm-artifacts` e `compare-wasm-interfaces`.

Para jogos web, a rede costuma revelar mais comportamento que o código: endpoints,
payloads, validações. Capture **uma sessão sua**, não dados de outros jogadores.

---

## Android / Flutter

| Caso | Ferramenta |
| --- | --- |
| APK genérico | `inspect_android_package` → `project-android-application-graph` |
| Código Java/Kotlin | JADX (provedor) |
| Flutter | `flutter-analysis` |
| Unity IL2CPP em APK | `inspect_il2cpp_metadata` + `open_binary` no `libil2cpp.so` |
| Instrumentação dinâmica | Frida (cuidado: anti-cheat, ToS) |

---

## Emuladores e ROMs

- Analise apenas dumps que você mesmo fez de cartuchos/mídias que possui.
- **Nunca** distribua ROMs, BIOS ou assets extraídos.
- O REA abre a imagem estática; ele não roda o jogo por você.

---

## O que não fazer com jogos

| Armadilha | Por quê |
| --- | --- |
| instrumentar jogo online com anti-cheat | viola ToS, risco de ban e de ilegalidade |
| descriptografar bundles/assets protegidos | o kit não faz; geralmente é ilícito |
| "reimplementar" música, sprites, mapa | é cópia de expressão protegida |
| publicar patch que redistribui dados do original | distribuição de material protegido |
| usar ROM de terceiros | cadeia de custódia quebrada — auditoria morre aqui |

---

## Exemplo de ponta a ponta (fictício)

Pergunta: *"qual a janela de invencibilidade após a esquiva?"*

1. Reconhecimento: build Unity IL2CPP, versão do metadata, binário principal.
2. Observação: executar em ambiente controlado, registrar o instante da esquiva e
   os instantes em que o dano é aceito/rejeitado.
3. Evidência: 30 execuções, com fps travado; IDs `EV-esquiva-01..30`.
4. Spec: "o dano é ignorado por N ms a partir do início da esquiva; o contador é
   reiniciado se uma nova esquiva começar antes do fim; empate no último ms conta
   como invencível".
5. Golden: casos com deslocamentos de 0, 1, N−1, N e N+1 ms, e esquiva encadeada.
6. Implementação: um contador de tempo e uma condição de invencibilidade; testes
   gerados dos vetores.
7. Auditoria: nenhum asset, nenhuma constante sem evidência, nenhum nome interno.

Repare que a spec final **não** contém uma linha do original — e ainda assim é
suficiente para implementar e provar equivalência.
