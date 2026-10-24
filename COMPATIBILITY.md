# Compatibilidade da Home TV

Análise de código em 23/10/2026. Instalar um APK, abrir a interface e substituir o
botão Home são capacidades diferentes. Só o aparelho abaixo teve validação física.

O [kit de ports](ports/README.md) prepara guias, contratos, templates e uma estrutura
sanitizada por plataforma. Ele não altera os estados de compatibilidade abaixo.

| Plataforma | Situação atual | Limitações |
|---|---|---|
| Fire TV AFTKM, Fire OS 8.1.8.5, Android 11/API 30 | Validado fisicamente | Catálogo, apps, detalhes, favoritos, controle e Explorar Mais. Home ainda passa pela Amazon; não é retorno instantâneo garantido. |
| Outros Fire TV com Fire OS | Candidatos, não certificados | Validar modelo, firmware, WebView, ADB e serviço de acessibilidade. Não garantir suporte só pela marca Fire TV. |
| Android TV / Google TV | Base Android compatível em princípio; não testado | Manifest declara LEANBACK_LAUNCHER, HOME e touchscreen opcional. Apps usam PackageManager. Atalhos Bluetooth/Sobre, restauração e serviço Home têm código Amazon; precisam adaptação e testes. Não usar scripts Fire OS nesses aparelhos. |
| Samsung Tizen | Não compatível diretamente | APK e Android Keystore/bridge Java não executam aqui. Precisa port de armazenamento seguro, rede, apps/ajustes, controle e pacote .wgt. Abrir HTML sozinho não entrega a integração nativa. |
| LG webOS | Não compatível diretamente | Precisa port das integrações nativas, armazenamento, controle e pacote .ipk. Não há versão Home TV para webOS neste projeto. |
| Fire TV com Vega OS | Não compatível diretamente | Plataforma e pacote .vpkg distintos de Fire OS/APK; exige port próprio. |
| Celular/tablet Android | Não suportado como produto | Interface paisagem feita para TV/controle; não validada para toque ou launcher de telefone. |

`minSdk 22` é apenas o mínimo das APIs nativas (Android 5.1), não promessa de
compatibilidade com Fire OS 5 ou todos os WebViews antigos. A interface usa optional
chaining, IntersectionObserver e CSS moderno. É necessário WebView atualizado;
o WebView do Fire OS 8 do aparelho testado funciona. Uma matriz de versões antigas
exige testes reais e possivelmente transpilar JS e fornecer fallbacks CSS.

O FreeMyTV original tinha implementações separadas para outras plataformas. Elas
utilizavam outra interface (`web/`) e não a Home TV atual: sua presença no fork não
transferia compatibilidade. Foram retiradas desta árvore para evitar essa confusão.
É possível usar um Fire TV/Android TV externo por HDMI em uma Samsung ou LG; nesse
caso o app roda no dispositivo externo, não no sistema Tizen/webOS da televisão.

## Fontes oficiais

- Android: [manifest e requisitos para TV](https://developer.android.com/training/tv/get-started/create).
- Amazon: [identificação de Fire OS e Vega por modelo](https://developer.amazon.com/docs/device-specs/identify-fire-tv-devices.html), [formatos APK/AAB e VPKG](https://developer.amazon.com/docs/app-submission/upload-app-file.html).
- Samsung: [empacotamento de aplicativos Tizen .wgt](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html).
- LG: [criação, pacote .ipk e instalação webOS](https://webostv.developer.lge.com/develop/getting-started/build-your-first-web-app).

## Antes de declarar uma nova plataforma suportada

Validar no aparelho: abrir e retomar, todos os D-pads, filtros/paginação e retorno dos
detalhes, teclado de chaves, Keystore, cache offline/cotas, apps/deep links, configurações,
Home e restauração sem perder dados. A substituição do Home depende do fabricante.
