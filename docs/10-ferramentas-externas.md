# 10 · Ferramentas externas (Ghidra, JDK, Docker, JADX)

O kit **não instala** engine de análise: o REA usa o que já existe na máquina.
Esta página é a lista fechada do que baixar, com versões fixadas, conferência de
SHA-256 e a configuração que o REA espera.

| Ferramenta | Para quê | Obrigatória? | Tamanho |
| --- | --- | --- | --- |
| **JDK 21** (Temurin) | rodar o Ghidra | sim, junto com o Ghidra | ~200 MB |
| **Ghidra 12.1.4** | binários nativos e Unity IL2CPP | sim, para Silksong e afins | 543 MB (zip) |
| **Docker Desktop** | isolamento nível L3 da sala limpa | não (L1/L2 funcionam sem) | ~1,5 GB |
| **JADX** | APK/Android | não (só alvos Android) | 70 MB |
| Hopper / IDA / Kuna | engines alternativas | não (pagos; Hopper é macOS) | — |

Versões verificadas pelo REA: **Ghidra 12.x ≥ 12.1**; o JDK precisa caber na
faixa declarada pela instalação (`application.java.min`). Ghidra **12.1.x pede
JDK 21+**; Ghidra **12.2 pede JDK 25+**. O combo testado pelo REA é **12.1.4 +
JDK 21** — é o padrão abaixo.

> **Onde instalar:** no Windows, se o REA roda no Windows (é o seu caso, com o
> Node portátil), instale Ghidra e JDK **no Windows**. O WSL só entra se você
> rodar o kit inteiro dentro dele.

---

## 1. Windows · PowerShell (recomendado)

Abra o PowerShell **como usuário normal** (o `winget` do JDK pede elevação; o
Ghidra não). O bloco é idempotente: pode rodar de novo sem duplicar nada.

```powershell
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"   # evita barra de progresso lenta em downloads grandes

# ---------- 1. JDK 21 (Temurin) ----------
winget install -e --id EclipseAdoptium.Temurin.21.JDK `
  --accept-source-agreements --accept-package-agreements

# localiza a pasta instalada e fixa JAVA_HOME no usuário (não mexe no PATH global)
$jdk = Get-ChildItem "$env:ProgramFiles\Eclipse Adoptium" -Directory -Filter "jdk-21*" |
       Sort-Object Name -Descending | Select-Object -First 1
if (-not $jdk) { throw "JDK não encontrado em Program Files\Eclipse Adoptium" }
[Environment]::SetEnvironmentVariable("JAVA_HOME", $jdk.FullName, "User")

# ---------- 2. Ghidra 12.1.4 ----------
$tools = "$env:USERPROFILE\cleanroom-tools"
New-Item -ItemType Directory -Force $tools | Out-Null

$ghZip = "$env:TEMP\ghidra_12.1.4_PUBLIC.zip"
Invoke-WebRequest `
  "https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_12.1.4_build/ghidra_12.1.4_PUBLIC_20260921.zip" `
  -OutFile $ghZip

$expected = "ddac49f903da9d5bac833e5cc79395098b9c33cfd3279be5f31bd00387d2d4db"
$actual   = (Get-FileHash $ghZip -Algorithm SHA256).Hash.ToLower()
if ($actual -ne $expected) { throw "SHA-256 do Ghidra não confere: $actual" }

# tar.exe já vem no Windows 10+ e é bem mais rápido que Expand-Archive
if (Get-Command tar.exe -ErrorAction SilentlyContinue) {
  tar -xf $ghZip -C $tools
} else {
  Expand-Archive -Path $ghZip -DestinationPath $tools -Force
}

$ghHome = Join-Path $tools "ghidra_12.1.4_PUBLIC"
if (-not (Test-Path "$ghHome\support\analyzeHeadless.bat")) { throw "extração inesperada: $ghHome" }
[Environment]::SetEnvironmentVariable("GHIDRA_INSTALL_DIR", $ghHome, "User")

# ---------- 3. aplica na sessão atual ----------
$env:JAVA_HOME          = [Environment]::GetEnvironmentVariable("JAVA_HOME", "User")
$env:GHIDRA_INSTALL_DIR = [Environment]::GetEnvironmentVariable("GHIDRA_INSTALL_DIR", "User")
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

java -version
Test-Path "$env:GHIDRA_INSTALL_DIR\support\analyzeHeadless.bat"
```

Saída esperada no fim: `openjdk version "21..."` e `True`.

### 1.1 Confirme que o REA aceita o provider

```powershell
rea doctor --provider ghidra --json
rea providers --json
```

Se o doctor reclamar de JDK, confira `$env:JAVA_HOME` (deve apontar para a pasta
que contém `bin\java.exe`) e se a versão atende à faixa do Ghidra. Se reclamar
do decompiler nativo, a extração saiu incompleta — apague a pasta e extraia de novo.

Teste rápido, sem tocar no jogo (copie o binário antes: o provider faz
admissão de caminho e a importação fria pode levar de 1 a 3 minutos):

```powershell
$fx = "$env:USERPROFILE\cleanroom-tools\fixtures"
New-Item -ItemType Directory -Force $fx | Out-Null
Copy-Item "C:\Windows\System32\notepad.exe" "$fx\notepad.exe"
rea inspect "$fx\notepad.exe" --provider ghidra --format json
```

Se o `inspect` falhar com erro de admissão de caminho, tente outro executável
copiado para `$fx` (o caminho precisa ser NTFS local, sem reparse point).

### 1.2 Registre de novo e reinicie o Codex

O REA grava `GHIDRA_INSTALL_DIR`/`JAVA_HOME` nos registros dos clientes no
momento do `setup`. Rode de novo **com as variáveis já definidas**:

```powershell
rea setup --client codex --dry-run --json
rea setup --client codex --yes
rea setup --client claude_code --yes
```

Depois **feche e reabra o Codex** (e o PowerShell). Sem reiniciar, o servidor MCP
continua com o ambiente antigo.

---

## 2. WSL / Linux (só se o kit rodar dentro do WSL)

```bash
sudo apt update && sudo apt install -y openjdk-21-jdk unzip curl

curl -L -o /tmp/ghidra.zip \
  https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_12.1.4_build/ghidra_12.1.4_PUBLIC_20260921.zip

echo "ddac49f903da9d5bac833e5cc79395098b9c33cfd3279be5f31bd00387d2d4db  /tmp/ghidra.zip" | sha256sum -c -

mkdir -p "$HOME/tools" && unzip -q /tmp/ghidra.zip -d "$HOME/tools"

cat >> "$HOME/.bashrc" <<'EOF'
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export GHIDRA_INSTALL_DIR="$HOME/tools/ghidra_12.1.4_PUBLIC"
EOF
source "$HOME/.bashrc"

java -version
rea doctor --provider ghidra --json
rea setup --client codex --yes
```

Em ARM64, o zip oficial não traz o decompiler nativo: ele precisa ser compilado
(`gradle buildDecompiler`). Em x64, o zip serve.

---

## 3. Docker (opcional, isolamento L3)

Só é necessário se você quiser a sala de implementação em container separado.
O fluxo L1/L2 funciona sem.

```powershell
winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
```

Depois: **saia e entre na sessão do Windows**, abra o Docker Desktop, espere o
motor ficar verde e construa a imagem do kit (~1,5 GB):

```powershell
docker build -t cleanroom-impl docker/impl
./docker/impl/run.sh silksong bash
```

Sem WSL2 instalado, instale antes: `wsl --install` (reinicia a máquina).
O `docker/impl/run.sh` monta **só o handoff** dentro do container — nada do alvo,
nada do REA.

---

## 4. JADX (opcional, só alvos Android)

```powershell
$jadx = "$env:USERPROFILE\cleanroom-tools\jadx"
New-Item -ItemType Directory -Force $jadx | Out-Null
Invoke-WebRequest "https://github.com/skylot/jadx/releases/download/v1.5.6/jadx-1.5.6.zip" `
  -OutFile "$env:TEMP\jadx.zip"
Expand-Archive "$env:TEMP\jadx.zip" -DestinationPath $jadx -Force

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$jadx\bin*") {
  [Environment]::SetEnvironmentVariable("Path", "$jadx\bin;$userPath", "User")
}
```

Versão com JRE embutido (não depende do JDK): `jadx-gui-1.5.6-with-jre-win.zip`.
Para Silksong (Unity IL2CPP) isso não é usado.

---

## 5. Checklist final

```powershell
node scripts/preflight.mjs --deep
rea doctor --provider ghidra --json
rea providers --json
```

- `Ghidra` e `Java (JDK)` devem sair **ok** no pré-voo.
- `rea doctor --provider ghidra --json` deve trazer `"healthy": true` e todos os
  `scope_checks` ok. O **código de saída pode ser 1**: `environment_healthy`
  também conta Hopper/IDA/JADX/Kuna e os registros dos outros clientes.
- Reinicie Codex/PowerShell e confirme as ferramentas `rea` dentro do agente.

---

## 6. Armadilhas específicas do Windows

| Situação | Efeito | Correção |
| --- | --- | --- |
| `GHIDRA_INSTALL_DIR` definido só na sessão (`$env:`) | Codex não vê | use `[Environment]::SetEnvironmentVariable(..., "User")` e reinicie |
| `JAVA_HOME` apontando para JRE, não JDK | doctor falha | aponte para a pasta com `bin\javac.exe` |
| Ghidra 12.2 com JDK 21 | provider não sobe | use JDK 25, ou fique no 12.1.4 |
| pasta com espaço/OneDrive "Files On-Demand" | arquivo vira placeholder, leitura falha | instale em `C:\Users\<você>\cleanroom-tools` e marque "manter neste dispositivo" |
| artefato em `\\wsl$\...`, rede, SUBST ou pendrive | Windows P0 recusa (exige NTFS local fixo) | `fsutil fsinfo drivetype J:\` deve dizer "Fixed Drive"; senão copie para `C:\` |
| Docker instalado sem reiniciar a sessão | `docker` não aparece | faça logoff/login |

O provider Ghidra no Windows é **P0: somente leitura** e cobre PE nativo x86,
x86-64, ARMNT e ARM64. Para Silksong (`GameAssembly.dll`, PE x64) é o suficiente.
