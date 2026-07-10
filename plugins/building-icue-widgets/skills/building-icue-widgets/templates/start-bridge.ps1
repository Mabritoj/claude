# Starts the local data bridge in the current console.
# Usage:  ./start-bridge.ps1  [-Port 37650]
param(
    [int]$Port = 37650
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Error "Node.js was not found on PATH. Install Node 18+ from https://nodejs.org and try again."
    exit 1
}

$env:PORT = $Port
Write-Host "Starting bridge on http://127.0.0.1:$Port ..." -ForegroundColor Cyan
Write-Host "Verify with: http://127.0.0.1:$Port/health   (Ctrl+C to stop)" -ForegroundColor DarkGray

node (Join-Path $scriptDir "bridge-server.mjs")
