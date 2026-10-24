# Fire TV com Vega OS

Vega OS é diferente de Fire OS e webOS. Reaproveitar a UI somente após escolher
um shell/WebView suportado pelo SDK Vega do modelo. Java Android, Keystore Android,
ADB e HomeWatcherService não são adaptadores Vega.

1. Confirmar o sistema pelo modelo/firmware; não escolher este destino para Fire OS.
2. Criar projeto pelo SDK oficial da versão alvo e verificar como incluir a UI
   compartilhada no shell suportado. Gerar o manifest pelo SDK; este kit não inventa
   um manifest nem projeto React Native com versões potencialmente incompatíveis.
3. Implementar fachada assíncrona, cofre adequado às APIs públicas, catálogo HTTPS,
   cotas/cache, controles/teclado e ciclo de vida. Não usar chaves fixas no JS.
4. Investigar abertura de apps e restrições do Home; não transportar o redirecionamento
   por acessibilidade da Amazon Android nem declarar sucesso sem API correspondente.
5. Configurar identidade/assinatura fora do Git e gerar `.vpkg` com tooling oficial.
   Validar no dispositivo e registrar limitações. Não executar scripts Fire OS.

Fontes: [build Vega](https://developer.amazon.com/docs/vega/latest/build-an-app),
[APK/AAB versus VPKG](https://developer.amazon.com/docs/app-submission/upload-app-file.html),
[identificar dispositivos](https://developer.amazon.com/docs/device-specs/identify-fire-tv-devices.html).
