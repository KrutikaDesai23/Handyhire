<#
.SYNOPSIS
Creates the local Python environment if needed and starts the HandyHire API.

USAGE
  Run from the repository root:
    .\start-backend.ps1
#>

$ErrorActionPreference = 'Stop'

$repoRoot = $PSScriptRoot
$backendDir = Join-Path $repoRoot 'backend'
$venvDir = Join-Path $backendDir '.venv'
$pythonExe = Join-Path $venvDir 'Scripts\python.exe'
$requirements = Join-Path $backendDir 'requirements.txt'
$installMarker = Join-Path $venvDir '.requirements-installed'
$port = 8000

if (-not (Test-Path $pythonExe)) {
    Write-Host 'Creating HandyHire Python environment...' -ForegroundColor Cyan
    if (Get-Command py -ErrorAction SilentlyContinue) {
        & py -3 -m venv $venvDir
    } elseif (Get-Command python -ErrorAction SilentlyContinue) {
        & python -m venv $venvDir
    } else {
        throw 'Python 3 is required. Install Python 3 and try again.'
    }
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not create the Python environment.'
    }
}

$installDependencies = -not (Test-Path $installMarker)
if (-not $installDependencies) {
    $installDependencies = (Get-Item $requirements).LastWriteTime -gt (Get-Item $installMarker).LastWriteTime
}

if ($installDependencies) {
    Write-Host 'Installing HandyHire backend dependencies...' -ForegroundColor Cyan
    & $pythonExe -m pip install --disable-pip-version-check -r $requirements
    if ($LASTEXITCODE -ne 0) {
        throw 'Dependency installation failed.'
    }
    New-Item -ItemType File -Path $installMarker -Force | Out-Null
}

$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    throw "Port $port is already in use. Stop the process using it, then retry."
}

Set-Location $backendDir
Write-Host ''
Write-Host 'Starting HandyHire backend at http://127.0.0.1:8000' -ForegroundColor Green
Write-Host 'API documentation: http://127.0.0.1:8000/docs'
Write-Host 'Press Ctrl+C to stop.'
Write-Host ''

& $pythonExe -m uvicorn app.main:app --reload --host 127.0.0.1 --port $port
if ($LASTEXITCODE -ne 0) {
    throw 'HandyHire backend stopped with an error.'
}
