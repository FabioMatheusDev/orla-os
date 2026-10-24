# Android TV e Google TV

Reaproveitar o APK/projeto Gradle da raiz, sem clonar Java/HTML em um segundo app.
Google TV faz parte deste destino Android; firmware e permissões variam por fabricante.

## Já existe

Manifest com LEANBACK_LAUNCHER, HOME e touchscreen opcional; lista/abertura de apps
via PackageManager; catálogo HTTPS e Keystore; UI por controle, cache e favoritos.

## Implementar e validar

1. Em `Bridge.java`, trocar atalhos Amazon de Bluetooth/Sobre por intents Android
   resolvidos com PackageManager, mantendo fallback e reportando indisponibilidade.
2. Separar restauração/Home por plataforma. `HomeWatcherService`, `Prefs` e
   `res/xml/home_watcher.xml` hoje observam a Amazon. Não ativar esse serviço nem
   executar `setup-home.*` em Android TV. Usar seleção de launcher somente quando
   o sistema oferecer; não prometer substituir Home em qualquer Google TV.
3. Preservar o código Fire OS com detecção de capacidades. Não alterar assinatura,
   package ID ou dados para criar uma variante de teste desnecessariamente.
4. Testar WebView, Keystore, teclado remoto, descoberta/abertura de apps, suspensão,
   retomada e Home no modelo escolhido. `minSdk` sozinho não prova suporte.
5. Criar instruções próprias de instalação/restauração Android TV. Não conceder
   acessibilidade/WRITE_SECURE_SETTINGS indiscriminadamente.

Build inicial: comandos da raiz em README.md. Após autorização de instalação,
instalar o APK de teste no alvo sem executar o instalador Fire OS; primeiro testar
a abertura manual. Fluxos da Play Store precisam avaliar os requisitos atuais da
loja separadamente do sideload local.

Fonte: [Android TV — criar e executar app](https://developer.android.com/training/tv/get-started/create).
