# orla · guia para agentes de IA

Você é um agente de IA (Claude Code, Codex, Gemini CLI, Antigravity ou outro) ajudando
uma pessoa a **instalar a orla na TV dela**. A pessoa provavelmente não é técnica.
Este arquivo diz o que é o projeto, como instalar em cada tipo de TV e o que você pode
e não pode fazer.

## Como se comportar

- Fale **no idioma da pessoa**, com frases curtas e sem jargão. Antes de cada passo que
  muda algo na TV ou no computador, diga o que vai fazer e por quê.
- **Ela faz os toques na TV; você roda os comandos no computador.** Diga exatamente qual
  menu abrir e o que apertar.
- Pergunte só o necessário: **qual é a TV** (marca e modelo, ou o nome em
  Configurações → Sobre), **o IP da TV**, **o sistema do computador** e **a cidade**
  (para o clima). Descubra o resto sozinho (`adb shell getprop`, etc.).
- Instale apenas as ferramentas que faltarem, e avise antes.
- Ao terminar, mostre como usar (tabela "Como usar" do [README](README.md)) e
  **como desfazer** naquela TV.

## O que é a orla

Uma tela inicial (launcher) para TV, em **HTML/CSS/JS puro** dentro de um app.
Mostra os apps instalados, destaques do TMDB, detalhes de títulos, TV ao vivo, clima e
atalhos. Não há servidor: tudo roda na TV.

- Interface: `app/src/main/assets/www/` (`index.html`, `style.css`, `app.js`, `catalog.js`).
- App Android (Fire OS, Google TV, Android TV): projeto Gradle na raiz, pacote
  `com.tvhome.launcher`. A interface fala com o sistema pela ponte `window.Android`
  (`app/src/main/java/com/tvhome/launcher/Bridge.java`).
- Contrato da ponte, para portar a outras TVs: [ports/CONTRACT.md](ports/CONTRACT.md) e
  [ports/platform-contract.d.ts](ports/platform-contract.d.ts).
- Detalhes técnicos: [DEVELOPMENT.md](DEVELOPMENT.md).

## Você pode adaptar o código para a TV da pessoa

**Sim, você tem permissão para alterar o projeto** para que ele rode na TV da pessoa:
criar o pacote da plataforma, escrever o adaptador da ponte, ajustar CSS/JS para um
navegador mais antigo, trocar intents, etc. Regras:

1. **Siga o protocolo oficial daquela TV** (modo desenvolvedor, conta, certificado,
   ferramenta de instalação). Os passos de cada uma estão abaixo. Não use root, jailbreak
   nem exploits.
2. **Mantenha a interface única.** Reaproveite `app/src/main/assets/www/` e implemente só
   a ponte da plataforma (`window.Android` ou um adaptador equivalente, ver CONTRACT.md).
   Capacidade que a TV não tem (por exemplo, listar todos os apps) fica **escondida**,
   nunca simulada.
3. **Não quebre o Fire OS.** O app Android atual precisa continuar compilando e passando
   nos testes (`DEVELOPMENT.md` → Testes). Coloque o código novo em pastas próprias
   (`ports/<plataforma>/…` ou `platforms/<plataforma>/`).
4. Ponto de partida pronto: `node scripts/prepare-port.cjs <android-tv|webos|tizen|vega>`
   gera uma cópia sanitizada da interface e um plano em `.local/ports/`.
5. Referência útil: o Free My TV original já rodava em LG e Samsung. A ponte web dele
   está no histórico do Git: `git show 4d73951:web/tv.js` (Luna/webOS e Tizen:
   listar apps, abrir apps, entradas HDMI, TV ao vivo).
6. Se a pessoa quiser, ofereça abrir um pull request com o port para o projeto.

## Antes de tudo, em qualquer TV

1. **Ferramentas comuns:** Git, Node.js 20+ e, para Android, JDK 17+, Android SDK
   (`platforms;android-34`, `build-tools;34.0.0`) e `adb`. Verifique o que já existe
   (`java -version`, `node -v`, `adb version`, `$ANDROID_HOME`).
2. **Chaves (opcionais):** TMDB (destaques e detalhes) e MDBList (notas). São da pessoa e
   secretas. **Não peça a chave no chat.** Depois de instalar, ela digita na própria TV em
   **☰ → Catálogo e chaves** (fica cifrada no aparelho). Sem chaves, o resto funciona.
3. Descubra o sistema de verdade antes de escolher o caminho: a marca não basta
   (Fire TV pode ser Fire OS ou Vega OS; uma TCL pode ser Google TV ou Roku).

---

## Fire TV com Fire OS (Fire TV Stick, Cube, TVs com Fire TV) · testado

1. **Na TV:** Configurações → Minha Fire TV → Sobre → clicar **7 vezes** no nome do
   aparelho. Voltar → **Opções do desenvolvedor → Depuração ADB: Ligado**.
   IP em Configurações → Minha Fire TV → Sobre → Rede.
2. **Instalar:** `.\scripts\install.ps1 -Ip <IP>` (Windows) ou `./scripts/install.sh <IP>`
   (macOS/Linux; antes `chmod +x gradlew scripts/*.sh`). Ele compila, instala e roda
   `setup-home`, que liga o serviço do botão Home.
3. A TV pergunta **"Permitir depuração USB?"**: a pessoa marca **"Sempre permitir"**.
4. **Teste:** botão Home → abre a orla (a tela da Amazon pode piscar antes; é normal).
5. **Desfazer:** ☰ → Restaurar tela original, ou `scripts/restore.* <IP>`
   (`-Uninstall`/`--uninstall` também remove o app).

Regras do Fire OS:
- A tela inicial da Amazon é **protegida** no Fire OS 8 e não pode ser desativada. Não
  tente (`pm disable`, `pm hide`, root). O botão Home volta à orla por um serviço de
  acessibilidade que só reage à tela inicial da Amazon.
- **Toda reinstalação desliga esse serviço:** rode `scripts/setup-home.* <IP>` depois.
- **Nunca** rode `am force-stop com.tvhome.launcher`: o Android também remove o serviço.

## Google TV e Android TV (Chromecast, Google TV Streamer, TCL, Sony, Philips, Xiaomi, onn…)

O mesmo APK roda. O que muda é como virar a tela inicial.

1. **Na TV:** Configurações → Sistema → Sobre (em algumas: Preferências do dispositivo →
   Sobre) → clicar **7 vezes** em **"Build do SO Android TV"**. Voltar → **Opções do
   desenvolvedor → Depuração USB: Ligado** (e **Depuração por rede**, se existir).
   Em Android 11+ algumas TVs pedem pareamento: `adb pair <IP>:<porta>` com o código
   mostrado na tela.
2. **Compilar e instalar sem o instalador do Fire OS:**
   `./gradlew assembleDebug`, `adb connect <IP>:5555`,
   `adb install -r app/build/outputs/apk/debug/app-debug.apk`. A pessoa aceita o aviso
   de depuração. **Não rode** `scripts/install.*` nem `setup-home.*` aqui: eles são do Fire OS.
3. **Adaptar** (siga [ports/android-tv/README.md](ports/android-tv/README.md)):
   - Em `Bridge.java`, os atalhos de Bluetooth e Sobre usam telas da Amazon: troque por
     intents do Android (`Settings.ACTION_BLUETOOTH_SETTINGS`, `ACTION_DEVICE_INFO_SETTINGS`).
   - O serviço `HomeWatcherService` observa a Amazon: **não ative** em Google/Android TV.
4. **Virar a tela inicial** (o manifesto já declara `CATEGORY_HOME`):
   - Primeiro tente o caminho limpo: `adb shell cmd package set-home-activity
     com.tvhome.launcher/.MainActivity`, ou o seletor de tela inicial, se a TV mostrar.
   - Se a TV ignorar (comum no Google TV), a orla funciona como app normal. Desativar a
     tela inicial original **só com autorização explícita**, sabendo os riscos: use
     `pm disable-user --user 0 <pacote>` (reversível com `pm enable`), **nunca** desinstale
     nem limpe dados de apps do sistema, e não desative o app de configuração inicial
     (`setupwraith`) nem apps que guardam redes Wi-Fi. Anote o que mudou para desfazer.
5. **Desfazer:** `adb shell pm enable <pacote>` para o que foi desativado e
   `adb uninstall com.tvhome.launcher`.

## LG (webOS)

O APK não roda na LG: a orla vira um **app web webOS (.ipk)**. A tela inicial da LG
continua; a orla abre como app (dá para fixá-la numa tecla numérica do controle).

1. **Conta LG:** a pessoa cria uma conta grátis em
   [webostv.developer.lge.com](https://webostv.developer.lge.com/) (Sign in → criar conta).
2. **Na TV:** LG Content Store → instalar o app **Developer Mode** → entrar com a conta →
   **Dev Mode Status: ON** (a TV reinicia) → abrir o app de novo → **Key Server: ON**.
   O app mostra o **IP** e uma **senha de 6 caracteres** (passphrase).
3. **Ferramentas:** webOS CLI (`npm install -g @webos-tools/cli`, comandos `ares-*`).
4. **Registrar a TV:** `ares-setup-device` → adicionar com o IP, porta **9922**, usuário
   **prisoner**, senha em branco. Depois `ares-novacom --device <nome> --getkey` e a
   pessoa digita a passphrase **no terminal dela** (não no chat).
5. **Montar o app:** `node scripts/prepare-port.cjs webos`, completar
   `appinfo.json` (id próprio, ícone 80×80 e 130×130) e escrever a ponte webOS
   (Luna Service: `applicationManager/listLaunchPoints` e `launch`; TV ao vivo =
   `com.webos.app.livetv`; base no `web/tv.js` do histórico). Pacote: `ares-package <pasta>`.
6. **Instalar e abrir:** `ares-install --device <nome> <arquivo>.ipk` e
   `ares-launch --device <nome> <id>`.
7. **Avisos para a pessoa:** o Developer Mode expira (cerca de 1000 horas, uns 40 dias);
   **EXTEND** no app renova. Se expirar, a LG remove os apps de desenvolvedor; é só
   reinstalar. As chaves precisam de armazenamento seguro disponível no webOS: se não
   houver, deixe os destaques sem chave e explique.
8. **Desfazer:** `ares-install --device <nome> --remove <id>`.

## Samsung (Tizen, TVs de 2017 em diante)

O APK não roda na Samsung: a orla vira um **app web Tizen (.wgt)**. A tela inicial da
Samsung continua; a orla abre como app.

1. **Na TV:** Apps → digitar **1 2 3 4 5** no controle → **Developer mode: ON** →
   **Host PC IP** = IP do computador → reiniciar a TV (desligar da tomada se não
   aparecer "Develop Mode" no topo dos Apps).
2. **Ferramentas:** Tizen Studio CLI (`tizen`, `sdb`) com as extensões **Samsung TV** e
   **Samsung Certificate** (Package Manager).
3. **Certificado:**
   - TVs **2023+ (Tizen 7+)**: certificado **Samsung**, criado com a conta Samsung da
     pessoa e o **DUID** da TV (Certificate Manager do Tizen Studio). A pessoa entra com a
     conta no navegador.
   - TVs **2017–2022**: certificado Tizen comum (`tizen certificate` +
     `tizen security-profiles add`).
   - Senhas de certificado são da pessoa: ela digita no terminal dela, nunca no chat.
     Use sempre o mesmo certificado nas atualizações.
4. **Montar o app:** `node scripts/prepare-port.cjs tizen`, completar `config.xml`
   (id, ícone, privilégios mínimos: `application.launch`, `tv.inputdevice`,
   `tv.window` para TV ao vivo) e escrever a ponte Tizen (`tizen.application`
   `getAppsInfo`/`launch`; TV ao vivo = `tizen.tvwindow.setSource` + `org.tizen.tv-viewer`;
   base no `web/tv.js` do histórico). Pacote assinado: `tizen package -t wgt -s <perfil>`.
5. **Instalar:** `sdb connect <IP>`, `tizen install -n <arquivo>.wgt -t <serial>` e
   `tizen run -p <id> -t <serial>`.
6. **Dica para a pessoa:** em Configurações, **"Execução automática do último app"**
   (Autorun Last App) faz a TV ligar direto na orla.
7. **Desfazer:** `tizen uninstall -p <id> -t <serial>`, ou na TV: Apps → orla → Excluir.

## Fire TV com Vega OS (Fire TV Stick 4K Select e modelos novos)

Vega OS não roda APK: precisa de um app Vega (`.vpkg`) feito com o SDK da Amazon.

1. **Conta:** a pessoa precisa de uma conta grátis de desenvolvedor Amazon
   ([developer.amazon.com](https://developer.amazon.com/)).
2. **Na TV:** Configurações → Minha Fire TV → Sobre → apertar o botão central **7 vezes**
   → Opções do desenvolvedor → **Developer Mode**. A ativação é concluída pelo `vega` CLI:
   ele pega um código na TV, a pessoa autentica no navegador e a TV reinicia.
3. **Ferramentas:** Vega SDK e Vega CLI (`vega --version`). Siga a documentação atual em
   [developer.amazon.com/docs/vega](https://developer.amazon.com/docs/vega/latest/build-an-app):
   os comandos mudam entre versões do SDK; confira antes de rodar.
4. **Montar o app:** `node scripts/prepare-port.cjs vega`, criar o projeto pelo SDK,
   carregar a interface num WebView suportado e escrever a ponte com as APIs públicas
   ([ports/vega/README.md](ports/vega/README.md)). Gerar e instalar o `.vpkg` pelo CLI.
5. Não use ADB, os scripts do Fire OS nem o serviço de acessibilidade: não existem no Vega.

## Outras TVs (Roku, Hisense VIDAA, Panasonic, Philips Saphi…)

Verifique se a plataforma aceita apps de terceiros com interface web e qual é o modo
desenvolvedor oficial; se aceitar, siga o mesmo modelo dos ports acima. Se não houver
caminho oficial, recomende um **Google TV Streamer ou Fire TV Stick no HDMI** e instale a
orla nele.

---

## Regras de segurança (sempre)

- **Chaves e senhas são da pessoa:** nunca peça no chat, nunca imprima, nunca coloque no
  Git, no APK, em `config.js` versionado ou em logs. Se a pessoa colar uma no chat, use
  só onde ela precisa ir e lembre que é melhor gerar outra.
- **Não faça** factory reset, root, jailbreak, desinstalação ou limpeza de dados de apps do
  sistema, nem mude rede, imagem, som ou conta da TV.
- Qualquer mudança no sistema da TV (desativar app, trocar tela inicial, ligar serviço)
  precisa de **autorização explícita** e de um jeito documentado de **desfazer**.
- Mantenha sempre o caminho de volta funcionando (restaurar a tela original).
- Antes de cada build: `node --check app/src/main/assets/www/app.js`. Depois de mudar código,
  rode os testes de [DEVELOPMENT.md](DEVELOPMENT.md).
- Não publique nada (push, release) sem a pessoa pedir.
- Preserve a licença MIT e os créditos do Free My TV ([LICENSE](LICENSE),
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)).
