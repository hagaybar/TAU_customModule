$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".."))

Write-Host "Starting API and worker..."
Start-Process -FilePath "node" -ArgumentList (Join-Path $repoRoot "api/server.js") -NoNewWindow
Start-Process -FilePath "node" -ArgumentList (Join-Path $repoRoot "worker/worker.js") -NoNewWindow

Write-Host "API: http://localhost:3185"
Write-Host "Use Ctrl+C to stop."
