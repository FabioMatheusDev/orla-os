#!/usr/bin/env bash
# Faz o botão Home do controle abrir a Home TV (Fire OS).
# Não desativa nem remove nada da Amazon. Preserva outros serviços de acessibilidade.
set -euo pipefail
IP="${1:?Informe o IP do Fire TV}"
D="$IP:5555"
PKG=com.tvhome.launcher
SVC=$PKG/$PKG.HomeWatcherService

adb connect "$D" >/dev/null
echo "==> Permissão para o botão 'Restaurar tela original' funcionar sozinho"
adb -s "$D" shell pm grant $PKG android.permission.WRITE_SECURE_SETTINGS || echo "   (aviso: não foi possível conceder; o restore pela TV só desliga o redirecionamento)"

echo "==> Ativando serviço do botão Home"
CUR=$(adb -s "$D" shell settings get secure enabled_accessibility_services | tr -d '\r')
if [ -z "$CUR" ] || [ "$CUR" = "null" ]; then
  NEW="$SVC"
elif echo ":$CUR:" | grep -q ":$SVC:"; then
  NEW="$CUR"
else
  NEW="$CUR:$SVC"
fi
adb -s "$D" shell settings put secure enabled_accessibility_services "$NEW"
adb -s "$D" shell settings put secure accessibility_enabled 1

echo "==> Abrindo a Home TV"
adb -s "$D" shell monkey -p $PKG -c android.intent.category.LEANBACK_LAUNCHER 1 >/dev/null 2>&1 \
  || adb -s "$D" shell am start -n $PKG/.MainActivity

echo "Pronto. Aperte o botão Home do controle para testar."
echo "Para desfazer: scripts/restore.sh $IP"
