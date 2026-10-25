[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$RemainingArgs
)

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
$LocalRoot = Join-Path $RepositoryRoot '.local'
$ExpectedReaVersion = '6.7.0'
$publishEnabled = -not (($RemainingArgs -contains '--no-publish') -or ($RemainingArgs -contains '--no-push'))
New-Item -ItemType Directory -Force -Path $LocalRoot | Out-Null

function Refresh-ProcessPath {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = @($machine, $user) -join ';'
}

function Test-NodeVersion {
    param([string]$Executable)
    if (-not $Executable -or -not (Test-Path -LiteralPath $Executable -PathType Leaf)) { return $false }
    & $Executable -e "const [a,b,c]=process.versions.node.split('.').map(Number); const ok=a>26||a===26||a===24&&b>=11||a===22&&b>=19; process.exit(ok?0:1)" 2>$null
    return $LASTEXITCODE -eq 0
}

function Find-CompatibleNode {
    $candidates = @()
    $command = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($command) { $candidates += $command.Source }
    if ($env:ProgramFiles) { $candidates += (Join-Path $env:ProgramFiles 'nodejs\node.exe') }
    if (${env:ProgramFiles(x86)}) { $candidates += (Join-Path ${env:ProgramFiles(x86)} 'nodejs\node.exe') }
    if ($env:LOCALAPPDATA) { $candidates += (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe') }
    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        if (Test-NodeVersion -Executable $candidate) { return $candidate }
    }
    return $null
}

function Install-WingetPackage {
    param([string]$PackageId)
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (-not $winget -and $env:LOCALAPPDATA) {
        $known = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\winget.exe'
        if (Test-Path -LiteralPath $known -PathType Leaf) { $winget = @{ Source = $known } }
    }
    if (-not $winget) { throw "winget não encontrado; instale $PackageId manualmente." }
    Write-Host "Instalando $PackageId com winget..."
    & $winget.Source install --exact --id $PackageId --accept-package-agreements --accept-source-agreements --disable-interactivity
    if ($LASTEXITCODE -ne 0) { throw "winget falhou ao instalar $PackageId (código $LASTEXITCODE)." }
    Refresh-ProcessPath
}

function Write-BootstrapFailure {
    param([string]$Message)
    $safe = $Message
    if ($env:USERPROFILE) { $safe = $safe.Replace($env:USERPROFILE, '<USUARIO>') }
    $safe = $safe.Replace($RepositoryRoot, '<REPOSITORIO>')
    $safe = $safe -replace 'github_pat_[A-Za-z0-9_]{20,}', '<SEGREDO_REMOVIDO>'
    $safe = $safe -replace 'gh[pousr]_[A-Za-z0-9]{20,}', '<SEGREDO_REMOVIDO>'
    $safe = $safe -replace 'https?://[^/\s@]+@', '<SEGREDO_REMOVIDO>'
    $timestamp = (Get-Date).ToUniversalTime().ToString('o')
    $report = Join-Path $RepositoryRoot 'reports\latest'
    New-Item -ItemType Directory -Force -Path $report | Out-Null
    Get-ChildItem -LiteralPath $report -Force | Remove-Item -Recurse -Force
    $contents = "# Erro de bootstrap SilksongREA`r`n`r`n- Data UTC: $timestamp`r`n- O analisador Node.js não pôde ser iniciado.`r`n`r`n## Diagnóstico`r`n`r`n" + $safe + "`r`n"
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText((Join-Path $report 'README.md'), "# Relatório SilksongREA`r`n`r`n**Status:** FALHA DE BOOTSTRAP`r`n`r`nVeja [errors.md](errors.md).`r`n", $encoding)
    [IO.File]::WriteAllText((Join-Path $report 'errors.md'), $contents, $encoding)
    $summary = @{
        schemaVersion = 1
        toolVersion = '1.0.0'
        startedAt = $timestamp
        status = 'failed'
        stages = @(@{ id = 'bootstrap'; title = 'Bootstrap'; status = 'failed'; message = $safe })
    } | ConvertTo-Json -Depth 5
    [IO.File]::WriteAllText((Join-Path $report 'summary.json'), $summary + "`r`n", $encoding)
    Write-Host 'Um diagnóstico foi salvo em reports/latest.'
}

function Publish-BootstrapFailure {
    $git = Get-Command git.exe -ErrorAction SilentlyContinue
    if (-not $git) { return }
    $branch = (& $git.Source -C $RepositoryRoot rev-parse --abbrev-ref HEAD 2>$null)
    if ($LASTEXITCODE -ne 0 -or -not $branch -or $branch -eq 'HEAD') { return }
    foreach ($ref in @('REBASE_HEAD', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD')) {
        & $git.Source -C $RepositoryRoot rev-parse --verify --quiet $ref 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Publicação do bootstrap cancelada: operação Git em andamento ($ref)." -ForegroundColor Yellow
            return
        }
    }
    $staged = @(& $git.Source -C $RepositoryRoot diff --cached --name-only 2>$null)
    $unrelated = @($staged | Where-Object { $_ -and -not $_.Replace('\', '/').StartsWith('reports/latest/') })
    if ($unrelated.Count -gt 0) {
        Write-Host 'Publicação do bootstrap cancelada: há alterações staged fora de reports/latest.' -ForegroundColor Yellow
        return
    }
    & $git.Source -C $RepositoryRoot add -- reports/latest
    if ($LASTEXITCODE -ne 0) { return }
    & $git.Source -C $RepositoryRoot diff --cached --quiet -- reports/latest
    if ($LASTEXITCODE -eq 0) { return }
    & $git.Source -C $RepositoryRoot commit -m 'chore: erro de bootstrap SilksongREA' -- reports/latest
    if ($LASTEXITCODE -ne 0) { return }
    & $git.Source -C $RepositoryRoot push origin "HEAD:refs/heads/$branch"
}

try {
    Set-Location -LiteralPath $RepositoryRoot
    $node = Find-CompatibleNode
    if (-not $node) {
        Install-WingetPackage -PackageId 'OpenJS.NodeJS.LTS'
        $node = Find-CompatibleNode
    }
    if (-not $node) {
        throw 'Node.js compatível não encontrado. É necessário 22.19+, 24.11+ ou 26+.'
    }

    if ($publishEnabled) {
        $git = Get-Command git.exe -ErrorAction SilentlyContinue
        if (-not $git) {
            Install-WingetPackage -PackageId 'Git.Git'
            Refresh-ProcessPath
        }
    }

    $reaPackage = Join-Path $RepositoryRoot 'node_modules\rea-agents\package.json'
    $installDependencies = $true
    if (Test-Path -LiteralPath $reaPackage -PathType Leaf) {
        try {
            $package = Get-Content -LiteralPath $reaPackage -Raw | ConvertFrom-Json
            $installDependencies = $package.version -ne $ExpectedReaVersion
        } catch {
            $installDependencies = $true
        }
    }

    if ($installDependencies) {
        $npm = $null
        $nodeDirectory = Split-Path -Parent $node
        $adjacentNpm = Join-Path $nodeDirectory 'npm.cmd'
        if (Test-Path -LiteralPath $adjacentNpm -PathType Leaf) { $npm = $adjacentNpm }
        if (-not $npm) {
            $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
            if ($npmCommand) { $npm = $npmCommand.Source }
        }
        if (-not $npm) { throw 'npm não encontrado ao lado do Node.js.' }
        Write-Host 'Instalando dependências fixadas com npm ci...'
        $bootstrapLog = Join-Path $LocalRoot 'bootstrap.log'
        & $npm ci --ignore-scripts --omit=optional --no-audit --no-fund 2>&1 | Tee-Object -FilePath $bootstrapLog
        if ($LASTEXITCODE -ne 0) {
            Write-Host 'npm ci falhou; o analisador continuará para registrar o diagnóstico.' -ForegroundColor Yellow
        }
    }

    $analyzer = Join-Path $RepositoryRoot 'scripts\run-analysis.mjs'
    & $node $analyzer @RemainingArgs
    exit $LASTEXITCODE
} catch {
    $message = $_.Exception.Message
    Write-Host "ERRO: $message" -ForegroundColor Red
    Write-BootstrapFailure -Message $message
    if ($publishEnabled) { Publish-BootstrapFailure }
    exit 1
}
