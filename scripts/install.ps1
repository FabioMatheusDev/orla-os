# Compila, instala e ativa a Home TV no Fire TV (Windows).
# Uso: .\scripts\install.ps1 -Ip 192.168.0.50
param([Parameter(Mandatory = $true)][string]$Ip)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

Write-Host '==> Compilando APK'
node --check app/src/main/assets/www/app.js
if ($LASTEXITCODE -ne 0) { throw 'JavaScript inválido' }
if (-not (Test-Path .\gradlew.bat)) { gradle wrapper --gradle-version 8.9 }
.\gradlew.bat --no-daemon assembleDebug
if ($LASTEXITCODE -ne 0) { throw 'Falha no build' }
$apk = 'app\build\outputs\apk\debug\app-debug.apk'

Write-Host "==> Conectando em $Ip (aceite o pedido de depuração na TV se aparecer)"
adb connect "${Ip}:5555"
adb -s "${Ip}:5555" wait-for-device

Write-Host '==> Instalando'
adb -s "${Ip}:5555" install -r $apk
if ($LASTEXITCODE -ne 0) { throw 'Falha na instalação' }

& (Join-Path $PSScriptRoot 'setup-home.ps1') -Ip $Ip
