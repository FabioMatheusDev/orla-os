# Faz o botão Home do controle abrir a Home TV (Fire OS). Windows.
# Não desativa nem remove nada da Amazon. Preserva outros serviços de acessibilidade.
param([Parameter(Mandatory = $true)][string]$Ip)
$d = "${Ip}:5555"
$pkg = 'com.tvhome.launcher'
$svc = "$pkg/$pkg.HomeWatcherService"

adb connect $d | Out-Null
Write-Host "==> Permissão para o botão 'Restaurar tela original' funcionar sozinho"
adb -s $d shell pm grant $pkg android.permission.WRITE_SECURE_SETTINGS

Write-Host '==> Ativando serviço do botão Home'
$cur = (adb -s $d shell settings get secure enabled_accessibility_services | Out-String).Trim()
if ([string]::IsNullOrEmpty($cur) -or $cur -eq 'null') { $new = $svc }
elseif (($cur -split ':') -contains $svc) { $new = $cur }
else { $new = "${cur}:$svc" }
adb -s $d shell settings put secure enabled_accessibility_services "$new"
adb -s $d shell settings put secure accessibility_enabled 1

Write-Host '==> Abrindo a Home TV'
adb -s $d shell am start -n "$pkg/.MainActivity" | Out-Null

Write-Host 'Pronto. Aperte o botão Home do controle para testar.'
Write-Host "Para desfazer: .\scripts\restore.ps1 -Ip $Ip"
