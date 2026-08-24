# Deploy a Render: pushea main y dispara el deploy hook.
# El repo esta conectado como "Public Git Repository" en Render, asi que
# no hay auto-deploy: este script hace push + hook en un solo paso.
#
# Uso:  .\deploy.ps1
# Requiere RENDER_DEPLOY_HOOK definida en .env.local (git la ignora).

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# Leer el hook desde .env.local sin cargar el resto de las variables
$linea = Select-String -Path '.env.local' -Pattern '^RENDER_DEPLOY_HOOK=(.+)$' | Select-Object -First 1
if (-not $linea) {
    Write-Error 'Falta RENDER_DEPLOY_HOOK en .env.local'
}
$hook = $linea.Matches[0].Groups[1].Value.Trim()

# Avisar si hay cambios sin commitear (se deploya lo commiteado, no el working tree)
$sucio = git status --porcelain
if ($sucio) {
    Write-Host "Atencion: hay cambios sin commitear que NO van a deployarse:" -ForegroundColor Yellow
    Write-Host $sucio
}

Write-Host "Pusheando main a GitHub..." -ForegroundColor Cyan
git push origin main
if ($LASTEXITCODE -ne 0) { Write-Error 'Fallo el push - no se dispara el deploy' }

Write-Host "Disparando deploy en Render..." -ForegroundColor Cyan
$respuesta = Invoke-RestMethod -Uri $hook -Method Get
Write-Host "Deploy disparado (id: $($respuesta.deploy.id))" -ForegroundColor Green
Write-Host "Segui el progreso en https://dashboard.render.com" -ForegroundColor Green
