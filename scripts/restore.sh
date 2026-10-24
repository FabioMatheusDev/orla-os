#!/usr/bin/env bash
# Volta o Fire TV ao normal: remove o serviço do botão Home (preservando os outros).
# Use --uninstall para também desinstalar a Home TV.
set -euo pipefail
IP="${1:?Informe o IP do Fire TV}"
D="$IP:5555"
PKG=com.tvhome.launcher
SVC=$PKG/$PKG.HomeWatcherService

adb connect "$D" >/dev/null
echo "==> Reativando a tela inicial da Amazon (se estava desativada)"
adb -s "$D" shell pm enable com.amazon.tv.launcher || true
CUR=$(adb -s "$D" shell settings get secure enabled_accessibility_services | tr -d '\r')
NEW=$(echo "$CUR" | tr ':' '\n' | grep -v -x "$SVC" | grep -v -x "$PKG/.HomeWatcherService" | grep -v -x 'null' | paste -sd: - || true)
if [ -z "$NEW" ]; then
  adb -s "$D" shell settings delete secure enabled_accessibility_services >/dev/null || true
else
  adb -s "$D" shell settings put secure enabled_accessibility_services "$NEW"
fi
adb -s "$D" shell am force-stop $PKG || true
# Preserve API keys, favorites and preferences. Only --uninstall removes app data.
echo "Se a TV perguntar qual tela inicial usar, escolha a da Amazon e 'Sempre'."

if [ "${2:-}" = "--uninstall" ]; then
  adb -s "$D" uninstall $PKG || true
fi

adb -s "$D" shell input keyevent KEYCODE_HOME
echo "Tela inicial original restaurada."
