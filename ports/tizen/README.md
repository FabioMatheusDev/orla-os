# Samsung Tizen

O APK Android não é usado. Reaproveitar a UI exportada em `ui/` e desenvolver a
integração Tizen, seguindo CONTRACT.md. O port começa como aplicativo; não assumir
que o SDK permite substituir o launcher da Samsung ou enumerar todos os apps.

1. Confirmar modelo/ano, versão Tizen e Web Engine; avaliar transpilar JS e CSS.
2. Criar projeto TV Web no SDK oficial. `config.xml.template` é uma referência;
   identidade de aplicação/pacote e certificado são definidos pelo SDK/desenvolvedor.
3. Implementar fachada assíncrona, controles/teclado/ciclo de vida e abertura de apps
   com APIs públicas disponíveis. Mapear IDs Tizen e falhas reais.
4. Verificar armazenamento seguro **acessível ao app de terceiros**. Não habilitar
   BYOK antes de proteger chaves. Não assumir permissões de parceiros/sistema.
5. Implementar transporte direto HTTPS com restrições de rede/CORS apropriadas,
   cache, paginação, cotas e erros, reaproveitando as políticas da raiz.
6. Criar ícone e ajustar permissões mínimas/CSP/hosts necessários (incluindo clima,
   imagens e demais recursos realmente usados); nunca liberar origens arbitrárias.
7. Empacotar/assinar `.wgt` pelo SDK e testar em aparelho autorizado. Guardar
   certificados/senhas fora do Git. Documentar restrições de Developer Mode/loja.

O template fica fora de `ui/` de propósito. Não há pacote instalável neste kit.

Fontes: [criar app TV Web](https://developer.samsung.com/smarttv/develop/getting-started/creating-tv-applications.html),
[CLI e pacote .wgt](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html).
