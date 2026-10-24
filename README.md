# Home TV

Launcher gratuito e open source para TV, com catálogo local-first e suas próprias
chaves de API (BYOK). Derivado do [FreeMyTV](https://github.com/simbasjungles/free-my-tv),
com a licença MIT original preservada em [LICENSE](LICENSE).

**Validado em Fire TV AFTKM / Fire OS 8.** Android TV e Google TV ainda precisam de
testes e ajustes específicos. O APK não roda diretamente em Samsung Tizen, LG webOS
ou Fire TV com Vega OS. Veja [COMPATIBILITY.md](COMPATIBILITY.md).

## Funcionalidades

- Interface Vidro/Sólido, apps instalados, Prime Video, clima e atalhos.
- Explorar, Filmes e Séries consultam TMDB e MDBList diretamente por HTTPS.
- Explorar Mais: grade paginada, tipo, gênero, ordem, listas, ano e busca.
- Navegação por controle entre fileiras reais, inclusive fora da área visível.
- Detalhes com sinopse completa, elenco, trailer, temporadas e abertura do streaming.
- Minha lista: favoritos locais com coração vermelho quando salvos.
- Sons locais e discretos para navegar, abrir, selecionar e cancelar; desligue em
  **☰ → Sons da interface**. A preferência fica salva no aparelho.
- Sem backend, VPS, Cloudflare ou computador ligado após a instalação.

O aplicativo organiza títulos e abre serviços instalados. Não fornece filmes,
assinaturas ou acesso gratuito ao conteúdo dos serviços de streaming.

## Configurar as chaves pelo controle

1. Pressione **☰** e abra **Catálogo e chaves**.
2. Cadastre sua API key TMDB v3 ou token de leitura v4.
3. Cadastre sua própria API key MDBList.
4. Volte ao catálogo. Sem chaves, os aplicativos continuam disponíveis.

Cada instalação utiliza suas próprias credenciais. É possível substituir/remover
cada chave nas configurações, sem exibir a anterior. TMDB sozinho permite catálogo
e detalhes; MDBList acrescenta listas e avaliações. A origem dos dados, atualização
e contador diário ficam nesse painel, junto da atribuição dos provedores.

As chaves são cifradas com AES-GCM e protegidas pelo Android Keystore (Android 5.1:
AES envolvida por RSA; Android 6+: AES no Keystore). A proteção por hardware depende
do aparelho. Backup Android está desativado. As chaves não são devolvidas ao JavaScript,
exibidas em diagnósticos ou registradas em logs. Não coloque chaves no Gradle/assets.
`.env.example` só documenta os nomes: **o APK não lê .env**.

## Cache e limites

Respostas persistem no armazenamento privado (até 8 MiB, LRU); imagens TMDB usam
até 60 MiB de cache. Falhas temporárias aproveitam dados salvos, inclusive após
reiniciar. O primeiro acesso sem dados salvos precisa de conexão. Respostas antigas
expiram após 30 dias; o prazo de atualização depende do tipo de consulta.

Há deduplicação, duas tarefas simultâneas, fila limitada, intervalo mínimo de 200 ms,
paginação e carregamento progressivo. Não há varredura completa do catálogo.
MDBList tem controle local de 1.000 chamadas diárias e janela de cinco minutos.
O painel distingue uso deste aparelho e saldo da conta informado pelo provedor.
Cache não consome chamadas. A cota pode ser compartilhada com outros aplicativos.
Ao esgotar, aparece aviso com horário da renovação (00:00 UTC), mantendo o cache.
Erros 202/429 respeitam pausa/Retry-After; 401/403 pausam tentativas; 5xx tem uma
repetição controlada. Limpar cache não remove chaves ou favoritos.

## Compilar

Execute na raiz deste repositório. Requisitos: JDK 17+, Node.js 20+ e Android SDK
com `platforms;android-34`, `build-tools;34.0.0` e platform-tools (ADB para instalar).
Configure `ANDROID_HOME` ou `local.properties` com `sdk.dir=CAMINHO_DO_SDK`.
Python 3 é usado nas auditorias. Não é necessário criar `.env` para compilar.

```powershell
node --check app/src/main/assets/www/app.js
.\gradlew.bat --no-daemon assembleDebug
python scripts/verify-apk.py
```

Linux/macOS: `chmod +x gradlew scripts/*.sh` e `./gradlew --no-daemon assembleDebug`.
APK de desenvolvimento: `app/build/outputs/apk/debug/app-debug.apk`.
O build sanitiza a configuração opcional `config.js`, copiando somente opções
públicas de uma lista explícita. Na ausência dela usa `config.example.js`.

O debug usa assinatura de desenvolvimento. `assembleRelease` gera APK **sem assinatura**;
para distribuir, use zipalign/apksigner com uma chave própria guardada fora do Git.
Mantenha a mesma assinatura nas atualizações. Release desativa depuração WebView.
Não publique APKs históricos que possam conter chaves embutidas.

## Instalar e desfazer no Fire OS

Ative a depuração ADB na TV e autorize o computador quando solicitado.
Windows: `scripts/install.ps1 -Ip SEU_IP`.
Linux/macOS: `scripts/install.sh SEU_IP`.
O instalador compila, atualiza o APK e executa `setup-home`, preservando outros
serviços de acessibilidade. Após instalar manualmente, execute `scripts/setup-home.*`.
Não force a parada do aplicativo durante testes normais: isso interfere no serviço Home.
Esses scripts são exclusivos do Fire OS; não os use em outras plataformas.

Home da Amazon e Prime Video permanecem disponíveis; não é necessário debloat.
O botão Home usa acessibilidade para retornar à Home TV. Ainda pode passar pela
Amazon e apresentar transição breve: não há garantia de retorno instantâneo.

Para parar o redirecionamento: `scripts/restore.ps1 -Ip SEU_IP` ou
`scripts/restore.sh SEU_IP`. Chaves e favoritos são preservados.
A opção explícita `-Uninstall` / `--uninstall` desinstala e apaga os dados do app.

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

Compile antes do teste de navegador e tenha Chrome instalado. Os testes usam fixtures,
sem gastar cotas. O workflow de CI executa build e testes sem credenciais pessoais.
As auditorias aceitam `--secrets CAMINHO_PRIVADO.env` para comparar valores conhecidos
em memória, sem imprimi-los. Não execute a auditoria com segredos como argumentos.
Veja [VERIFICATION.md](VERIFICATION.md) e [SECURITY_AUDIT.md](SECURITY_AUDIT.md).

## Estrutura e contribuição

Para iniciar uma adaptação a Samsung Tizen, LG webOS, Android TV/Google TV ou
Fire TV Vega OS, consulte o [kit de ports](ports/README.md). Ele inclui guias,
contrato das integrações, modelos de manifest e um gerador de estrutura sanitizada.
É uma preparação para desenvolvimento; não acrescenta suporte certificado a essas TVs.

- `app/`: Android Java e interface HTML/CSS/JS puro em `src/main/assets/www/`.
- `scripts/`: assets públicos, instalação/restauração Fire OS e auditorias.
- `tests/`: catálogo, política Java e navegação por controle.
- `ports/`: pontos de partida para adaptar a Home TV a outras plataformas.
- `gradle/` e `gradlew*`: wrapper de build.
- `COMPATIBILITY.md`: plataformas, limitações e fontes oficiais.
- `THIRD_PARTY_NOTICES.md`, `LICENSE`: créditos e licenças.

`catalog.js` abstrai os provedores; `CatalogNative` implementa HTTPS/cotas/cache e
`CredentialVault` protege chaves. Um transporte futuro pode usar proxy sem reescrever
a interface. Não há backend neste projeto. Os ports antigos do FreeMyTV usavam outra
interface e foram retirados. SDK, caches e dependências npm não são versionados.

Para contribuir, preserve navegação por controle e use fixtures nos testes.
Não publique `.env`, configurações privadas, keystores, SDKs, caches ou APKs antigos.
Uma auditoria anterior identificou chave em checkpoint local: recomenda-se revogá-la.
Não use `git push --mirror` nem envie refs/codex ou a pasta .git inteira para publicar.
Nenhum remoto foi alterado ou publicação realizada por esta preparação.

## Fontes e atribuição

- [MDBList API](https://docs.mdblist.com/docs/api).
- [TMDB API](https://developer.themoviedb.org/docs/getting-started),
  [limites](https://developer.themoviedb.org/docs/rate-limiting) e
  [atribuição](https://developer.themoviedb.org/docs/faq).
- Avisos de terceiros em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

This product uses the TMDB API but is not endorsed or certified by TMDB.
BYOK não substitui os termos dos provedores e não concede direitos sobre seus dados.
