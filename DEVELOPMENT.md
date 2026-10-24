# orla · guia técnico

Detalhes para quem vai compilar, testar ou contribuir. O guia para o público está no
[README](README.md).

## Chaves (BYOK)

Cada instalação usa as próprias chaves, cadastradas pelo controle em
**☰ → Catálogo e chaves**. É possível substituir ou remover cada chave sem exibir a anterior.
TMDB sozinho permite catálogo e detalhes; MDBList acrescenta as notas do IMDb e do Rotten Tomatoes.

As chaves são cifradas com AES-GCM e protegidas pelo Android Keystore (Android 5.1:
AES envolvida por RSA; Android 6+: AES no Keystore). A proteção por hardware depende
do aparelho. O backup do Android está desativado. As chaves não voltam ao JavaScript,
não aparecem em diagnósticos nem em logs. Não coloque chaves no Gradle nem nos assets.
`.env.example` só documenta os nomes: **o APK não lê .env**.

## Cache e limites

Respostas ficam no armazenamento privado (até 8 MiB, LRU); imagens do TMDB usam até
60 MiB de cache. Falhas temporárias usam dados salvos, inclusive após reiniciar. O primeiro
acesso sem dados salvos precisa de conexão. Respostas antigas expiram após 30 dias.

Há deduplicação, duas tarefas simultâneas, fila limitada, intervalo mínimo de 200 ms,
paginação e carregamento progressivo. As três fileiras da Home ("Em alta nos filmes",
"Em alta nas séries" e "Lançamentos") usam só o TMDB, sem cota diária. O MDBList, com
controle local de 1.000 chamadas por dia e janela de cinco minutos, só é consultado ao
abrir os Detalhes de um título. Ao esgotar a cota, aparece aviso com o horário da
renovação (00:00 UTC) e o cache continua valendo. Erros 202/429 respeitam
pausa/Retry-After; 401/403 pausam tentativas; 5xx tem uma repetição controlada.
Limpar o cache não remove chaves nem favoritos.

## Compilar

Na raiz do repositório. Requisitos: JDK 17+, Node.js 20+ (gera os assets públicos no
build) e Android SDK com `platforms;android-34`, `build-tools;34.0.0` e platform-tools
(ADB). Configure `ANDROID_HOME` ou `local.properties` com `sdk.dir=CAMINHO_DO_SDK`.
Python 3 é usado nas auditorias.

```powershell
node --check app/src/main/assets/www/app.js
.\gradlew.bat --no-daemon assembleDebug
python scripts/verify-apk.py
```

Linux/macOS: `chmod +x gradlew scripts/*.sh` e `./gradlew --no-daemon assembleDebug`.
APK: `app/build/outputs/apk/debug/app-debug.apk`. O build copia de `config.js`
(opcional, ignorado pelo Git) só as opções públicas de uma lista explícita; sem ele,
usa `config.example.js`.

O debug usa assinatura de desenvolvimento. `assembleRelease` gera APK **sem assinatura**;
para distribuir, assine com zipalign/apksigner e uma chave própria guardada fora do Git,
sempre a mesma nas atualizações. O release desativa a depuração da WebView.

## Instalação no Fire OS (o que os scripts fazem)

`scripts/install.*` compila, conecta por ADB (`IP:5555`), instala com `install -r` e roda
`scripts/setup-home.*`, que concede `WRITE_SECURE_SETTINGS` e acrescenta o serviço de
acessibilidade `HomeWatcherService` sem apagar outros serviços.

- Toda reinstalação desliga o serviço de acessibilidade no Fire OS: rode `setup-home` de novo.
- Não use `am force-stop` no app: o Android também remove o serviço.
- A Home da Amazon (`com.amazon.tv.launcher`) é um pacote protegido no Fire OS 8 e não pode
  ser desativada; o botão Home volta para a orla pelo serviço de acessibilidade, que só
  reage à tela inicial da Amazon (`HomeWindowPolicy`).
- `scripts/restore.*` desliga o redirecionamento e preserva chaves e favoritos;
  `-Uninstall` / `--uninstall` também desinstala e apaga os dados do app.

## Abertura (motion/)

O vídeo da abertura é gerado em código: `motion/sound.mjs` sintetiza a trilha e mede as
batidas (`beats.json`), `motion/intro.html` é a animação (uma função do tempo) e
`motion/render.mjs` exporta 3840×2160 a 60 fps (H.264, CRF 16, áudio a −14 LUFS).
Regras em [motion/RULES.md](motion/RULES.md). O ícone e o banner vêm de
`motion/brand-assets.mjs`.

```bash
node motion/sound.mjs && node motion/render.mjs --sheet   # folha de contato para revisar
node motion/render.mjs                                    # vídeo final em motion/out/
```

No app, `Intro.java` toca `res/raw/orla_intro.mp4` com o player nativo na primeira abertura
depois que a TV liga (`Settings.Global.BOOT_COUNT`). Em builds debug,
`am start -n com.tvhome.launcher/.MainActivity --ez play_intro true` força a abertura.

## Testes

```powershell
node tests/catalog.test.cjs
node --test tests/ports.test.cjs
javac -encoding UTF-8 -d app/build/policy-check app/src/main/java/com/tvhome/launcher/CatalogPolicy.java tests/CatalogPolicyTest.java
java -cp app/build/policy-check com.tvhome.launcher.CatalogPolicyTest
javac -d app/build/policy-check app/src/main/java/com/tvhome/launcher/HomeWindowPolicy.java tests/HomeWindowPolicyTest.java
java -cp app/build/policy-check com.tvhome.launcher.HomeWindowPolicyTest
npm ci --prefix tests
node tests/browser.cjs
python scripts/audit-credentials.py
python scripts/verify-apk.py
```

Compile antes do teste de navegador e tenha o Chrome instalado. Os testes usam fixtures,
sem gastar cotas. O CI (`.github/workflows/check.yml`) roda build e testes sem credenciais.
Veja [VERIFICATION.md](VERIFICATION.md) e [SECURITY_AUDIT.md](SECURITY_AUDIT.md).

## Estrutura

- `app/`: Android em Java e interface em HTML/CSS/JS puro (`src/main/assets/www/`).
  `catalog.js` abstrai os provedores; `CatalogNative` faz HTTPS, cotas e cache;
  `CredentialVault` protege as chaves; `Intro` toca a abertura.
- `motion/`: abertura, trilha e artes da marca, geradas em código.
- `scripts/`: assets públicos, instalação e restauração no Fire OS, auditorias.
- `tests/`: catálogo, políticas Java e navegação pelo controle.
- `ports/`: ponto de partida para adaptar a orla a Google TV/Android TV, LG webOS,
  Samsung Tizen e Vega OS ([kit de ports](ports/README.md)). Não é suporte certificado.
- `COMPATIBILITY.md`: plataformas e limitações. `THIRD_PARTY_NOTICES.md`, `LICENSE`: créditos.

O pacote Android continua `com.tvhome.launcher` para que instalações existentes mantenham
as preferências.

## Contribuir

Preserve a navegação pelo controle e use fixtures nos testes. Não publique `.env`,
`config.js`, keystores, SDKs, caches ou APKs antigos.

## Fontes e atribuição

- [TMDB API](https://developer.themoviedb.org/docs/getting-started),
  [limites](https://developer.themoviedb.org/docs/rate-limiting) e
  [atribuição](https://developer.themoviedb.org/docs/faq).
- [MDBList API](https://docs.mdblist.com/docs/api).
- Avisos de terceiros em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

This product uses the TMDB API but is not endorsed or certified by TMDB.
