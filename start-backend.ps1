<#
.SYNOPSIS
Starts the HandyHire FastAPI backend development server on port 8000.

USAGE
  From PowerShell:
    .\start-backend.ps1

  Or from CMD:
    powershell -ExecutionPolicy Bypass -File .\start-backend.ps1
#>

$ErrorActionPreference = 'Stop'

$backendDir = 'C:\handyhire\backend'
$venvDir    = Join-Path $backendDir 'venv'
$pythonExe  = Join-Path $venvDir 'Scripts\python.exe'
$port       = 8000

function Test-PortInUse {
    param([int]$Port = $port)
    $lines = netstat -ano | Select-String ":${Port}\s+.*LISTENING"
    return $lines
}

function Get-PidsFromNetstat {
    param([string[]]$Lines)
    $pids = @{}
    foreach ($line in $Lines) {
        $parts = $line -split '\s+'
        $candidate = $parts[-1]
        if ($candidate -match '^\d+$') {
            $pids[$candidate] = $true
        }
    }
    return $pids.Keys | ForEach-Object { [int]$_ }
}

# ---------- validate venv ----------
if (-not (Test-Path $pythonExe)) {
    Write-Host ''
    Write-Host 'ERROR: Python venv not found.' -ForegroundColor Red
    Write-Host 'Expected:' $pythonExe
    Write-Host 'Create it with: python -m venv' $venvDir
    exit 1
}

# ---------- check port ----------
$inUse = Test-PortInUse
if ($inUse) {
    $pids = Get-PidsFromNetstat -Lines $inUse
    $handyhirePid = $null

    foreach ($processId in $pids) {
        $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if (-not $proc) { continue }
        $procName = $proc.ProcessName
        Write-Host "Port $port is in use by PID $processId ($procName)" -ForegroundColor Yellow
        if ($procName -match 'uvicorn|python') {
            $handyhirePid = $processId
        }
    }

    if ($handyhirePid) {
        Write-Host ''
        Write-Host 'A HandyHire/Uvicorn process (PID' $handyhirePid ') is already running on port' $port '.' -ForegroundColor Cyan
        Write-Host 'If you want to restart it, stop the process first and re-run this script.'
        exit 0
    }

    Write-Host ''
    Write-Host 'Port' $port 'is occupied by another application.' -ForegroundColor Red
    Write-Host 'Free the port and try again.'
    exit 1
}

# ---------- start backend ----------
Write-Host ''
Write-Host '======================================' -ForegroundColor Cyan
Write-Host '  Starting HandyHire Backend' -ForegroundColor Cyan
Write-Host '  http://127.0.0.1:' $port -ForegroundColor Cyan
Write-Host '======================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Backend dir :' $backendDir
Write-Host 'Python      :' $pythonExe
Write-Host 'Press Ctrl+C to stop.'
Write-Host ''

Set-Location $backendDir

try {
    & $pythonExe -m uvicorn app.main:app --host 127.0.0.1 --port $port --reload
} catch {
    Write-Host ''
    Write-Host 'Failed to start backend:' $_ -ForegroundColor Red
    exit 1
}
