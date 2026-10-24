#!/usr/bin/env bash
# Compila, instala e ativa a Home TV no Fire TV.
# Uso: scripts/install.sh 192.168.0.50
set -euo pipefail
IP="${1:?Informe o IP do Fire TV. Ex.: scripts/install.sh 192.168.0.50}"
cd "$(dirname "$0")/.."

echo "==> Compilando APK"
node --check app/src/main/assets/www/app.js
if [ ! -x ./gradlew ]; then gradle wrapper --gradle-version 8.9; fi
./gradlew --no-daemon assembleDebug
APK=app/build/outputs/apk/debug/app-debug.apk

echo "==> Conectando em $IP (aceite o pedido de depuração na TV se aparecer)"
adb connect "$IP:5555"
adb -s "$IP:5555" wait-for-device

echo "==> Instalando"
adb -s "$IP:5555" install -r "$APK"

"$(dirname "$0")/setup-home.sh" "$IP"
