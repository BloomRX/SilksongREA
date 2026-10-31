# Alvos: aplicativos

Aplicativos costumam ser mais fáceis que jogos: o comportamento é mais explícito e
as ferramentas cobrem o empacotamento. O risco muda de lugar — dados de usuário,
credenciais e propriedade intelectual de terceiros.

**Comece pelo detector:** `./scripts/detect-target.sh <slug>` reconhece
Electron/ASAR, .NET (pelo cabeçalho CLI do PE), Android, Apple, Python
empacotado, SQLite, capturas de rede e web, e recomenda a rota no REA.

## Regras específicas de apps

1. **Use a sua própria conta e os seus próprios dados.** Nada de capturar tráfego
   de outras pessoas.
2. **Não contorne autenticação, licenciamento ou paywall.**
3. **Não extraia dados de usuários nem segredos.** Se aparecer uma chave de API
   nos artefatos, trate como achado de segurança — não use, não publique.
4. **Interoperabilidade é o enquadramento mais seguro.** "Quero ler/escrever o
   formato X" é diferente de "quero clonar o produto".

---

## Electron / ASAR / JavaScript

O caso mais comum e o mais rápido de analisar.

| Passo | Ferramenta |
| --- | --- |
| Analisar árvore extraída ou ASAR | `analyze_javascript_application` |
| Rastrear uma feature na UI até o código | `trace-application-feature` |
| Comparar duas versões | `compare-application-versions` |
| Conciliar runtime com bundle | `reconcile-javascript-runtime` |
| Inventário de rotas | `javascript-route-inventory` |

```bash
# não precisa de engine nativa nem de MCP
npx -y rea-agents@latest analyze-javascript-application /caminho/app --json
```

O resultado traz módulos, imports, fronteiras Electron (main/preload/renderer) e
evidências. É ótimo para entender **fluxo** (ex.: área de transferência, IPC,
atalhos globais) sem ler código minificado como se fosse spec.

**Cuidado clássico:** bundle minificado é a expressão do original. Descreva o
comportamento; não cole o bundle nem trechos dele na spec.

---

## .NET (desktop e serviços)

| Passo | Ferramenta |
| --- | --- |
| Inventariar assembly | `inspect_managed_artifact` |
| Comparar builds | `compare-managed-members` |
| Grafo da aplicação | `project-managed-application-graph` |
| Reconstrução | `import-managed-reconstruction` |
| Fronteiras nativas | `verify-managed-native-boundaries` |

.NET NativeAOT é binário nativo: use Ghidra e o workflow NativeAOT documentado
pelo REA.

---

## Android

| Passo | Ferramenta |
| --- | --- |
| Pacote e classes | `inspect_android_package` |
| Grafo | `project-android-application-graph` |
| Código | JADX |
| Recursos | Apktool |
| Flutter | `flutter-analysis` |
| Instrumentação | Frida (evite apps com anti-tamper) |

APK/IPA são containers: `open_binary`/`inspect_artifact` para inventário de
membros, depois as ferramentas específicas.

---

## Apple (macOS/iOS)

| Passo | Ferramenta |
| --- | --- |
| Plists, asset catalogs, nibs, keyed archives | `open_bundle_resources` |
| Grafo da aplicação | `project-apple-application-graph` |
| Binário nativo (Mach-O) | `open_binary` + provedor |
| IPS/crash logs | guia `apple-ips` |

Recursos de bundle não têm digest de executável: eles não provam comportamento.

---

## Python empacotado

- PyInstaller: `open_binary` no executável → `inspect_artifact`.
- O **CArchive é a camada da aplicação**; o bootloader é só o prefixo nativo.
- Comece com `detail: "summary"` e pagine o inventário.

Guia do REA: `python-packaged-applications`.

---

## Web (SaaS, painéis, apps web)

| Passo | Ferramenta |
| --- | --- |
| Observar páginas e bundles | famílias `browser`, `javascript-runtime` |
| Capturas de rede | `pcap`, HAR |
| Ambiente reproduzível | `environment-build` |

Fluxo saudável: grave **sua** sessão, entenda endpoints e validações, documente o
contrato (método, rota, payload, erros) e implemente um cliente independente.

Fluxo doente: raspar dados de terceiros, burlar rate limit, replicar conta alheia.

---

## Firmware e dispositivos

`inspect_firmware_regions` → `extract_firmware` (Binwalk/Unblob no Linux) →
`open_binary` na imagem extraída. Só em hardware que você possui. Cuidado com
chaves e credenciais embutidas: achado de segurança, não material de spec.

---

## Formato de arquivo / interoperabilidade

Um dos melhores usos de clean room: documentar um formato para permitir
importação/exportação independente.

O que entra na spec:

- layout de cabeçalho, campos, endereçamento, endianness;
- invariantes, checksums, versões;
- comportamento em arquivo corrompido/truncado;
- vetores: arquivo de entrada (ou fixture sintética) → saída esperada.

O que **não** entra: arquivos reais protegidos, assets embutidos, chaves.

Prefira criar fixtures sintéticas que exercitem cada campo. Elas são testáveis,
distribuíveis e não carregam material de terceiros.

---

## Tabela de decisão rápida

| Alvo | Primeiro comando | Provedor nativo? |
| --- | --- | --- |
| App Electron | `analyze_javascript_application` | não |
| Site/app web | observação de navegador + captura | não |
| App .NET | `inspect_managed_artifact` | não (exceto NativeAOT) |
| APK | `inspect_android_package` | JADX |
| App macOS/iOS | `open_bundle_resources` | sim, para Mach-O |
| Python empacotado | `open_binary` + `inspect_artifact` | não |
| Binário nativo desktop | `open_binary` | sim |
| Firmware | `inspect_firmware_regions` | não (Binwalk/Unblob) |

---

## Antipadrões em apps

| Antipadrão | Risco |
| --- | --- |
| capturar sessão de outra pessoa | privacidade/LGPD, violação de ToS |
| usar chave de API encontrada | ilícito e inseguro |
| replicar assinatura de licença | fraude |
| copiar textos de UI e ícones | direitos autorais |
| publicar bundle "para referência" | distribuição de obra protegida |
| automatizar app de terceiros contra ToS | risco civil e contratual |
