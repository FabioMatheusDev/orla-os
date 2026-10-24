# Volta o Fire TV ao normal (Windows). -Uninstall também remove o app.
param([Parameter(Mandatory = $true)][string]$Ip, [switch]$Uninstall)
$d = "${Ip}:5555"
$pkg = 'com.tvhome.launcher'
$svc = "$pkg/$pkg.HomeWatcherService"

adb connect $d | Out-Null
Write-Host '==> Reativando a tela inicial da Amazon (se estava desativada)'
adb -s $d shell pm enable com.amazon.tv.launcher
$cur = (adb -s $d shell settings get secure enabled_accessibility_services | Out-String).Trim()
$keep = @($cur -split ':' | Where-Object { $_ -and $_ -ne 'null' -and $_ -ne $svc -and $_ -ne "$pkg/.HomeWatcherService" })
if ($keep.Count -eq 0) { adb -s $d shell settings delete secure enabled_accessibility_services | Out-Null }
else { adb -s $d shell settings put secure enabled_accessibility_services ($keep -join ':') }
adb -s $d shell am force-stop $pkg
# Preserve API keys, favorites and preferences. Only -Uninstall removes app data.
Write-Host "Se a TV perguntar qual tela inicial usar, escolha a da Amazon e 'Sempre'."

if ($Uninstall) { adb -s $d uninstall $pkg }

adb -s $d shell input keyevent KEYCODE_HOME
Write-Host 'Tela inicial original restaurada.'
