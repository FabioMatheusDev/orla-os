# Contrato de integração

Este documento descreve a ponte **existente**; não injeta mocks no aplicativo.
Referência de tipos: [platform-contract.d.ts](platform-contract.d.ts).

## Interface e sistema

Som opcional: a ponte Android implementa `uiSoundsEnabled`, `setUiSoundsEnabled` e
`playUiSound(move|click|select|cancel)`. Os WAVs originais ficam em `app/src/main/res/raw`;
gerador em `scripts/generate-ui-sounds.py`. Um port pode implementar áudio local com
baixa latência respeitando mute/ciclo de vida. Ausência dessa capacidade não bloqueia
a interface; não fazer chamadas de rede nem tocar som ao restaurar foco automaticamente.

Hoje `app.js` detecta `window.Android` e usa chamadas síncronas da ponte Java.
Um port web não deve simplesmente criar esse objeto vazio: isso ativa caminhos
nativos sem implementá-los. SDKs Tizen/webOS geralmente exigem callbacks/promises.
Antes de conectar esses SDKs, extrair uma fachada assíncrona para apps, arte,
abertura, ajustes e ciclo de vida, adaptando os pontos de uso em `app.js`.
Implementar primeiro o adaptador Android dessa fachada, mantendo os testes atuais.
Os tipos abaixo documentam o legado, não exigem bloquear o event loop do novo port.

`getArt` retorna `banner:data:...`, `icon:data:...` ou string vazia. IDs de apps são
opacos, específicos da plataforma; não usar package names Android como IDs universais.
Nenhuma ausência de API deve retornar sucesso fictício. Criar capacidades explícitas
para apps, atalhos, trailer e controle do Home, e ocultar ações indisponíveis.
`homeStatus`, `setRedirect`, `restoreOriginalHome` são hoje específicos do Fire OS.
Não reproduzir interceptação de Home em sistemas que não a autorizam.

## TV ao vivo

A interface mostra o card "TV ao vivo" como primeiro item de "Todos os apps" só quando
`liveTvPackage()` devolve um id não vazio, e o abre com `openLiveTv()`. O app de TV ao vivo
retornado não é repetido na lista de apps. Sem a capacidade, o card não aparece.

- Android, Google TV, Android TV e Fire OS (implementado e testado em Fire OS 8.1.8.5):
  `ACTION_VIEW` em `TvContract.Channels.CONTENT_URI` (`content://android.media.tv/channel`)
  abre o app de TV ao vivo do aparelho; no Fire OS, `com.amazon.tv.livetv`, sem passar pela
  Home da Amazon. Reserva: apps conhecidos (`com.google.android.tv`, `com.android.tv`,
  `com.tcl.tv`, `com.mediatek.wwtv.tvcenter`, `com.sony.dtv.tvx` e outros, em `Bridge.java`).
  Precisa da entrada `<queries>` de VIEW com `content://android.media.tv` no manifesto.
- webOS (não testado): abrir `com.webos.app.livetv` pelo `applicationManager/launch` do Luna.
  A versão web do Free My TV fazia assim; o código está no histórico do Git (`web/tv.js`).
- Tizen (não testado): `tizen.tvwindow.setSource` para a fonte TV e abrir `org.tizen.tv-viewer`
  com `tizen.application.launch`; exige os privilégios `tv.inputdevice`/`tv.window` do manifesto.
- Vega OS e outros: sem caminho confirmado; deixar a capacidade ausente (card escondido).

## Catálogo

Reaproveitar `CatalogCore.createCatalog(transport, config)` de `catalog.js`.
O transporte tem `status()`, `settings()` e `request(provider, path, params)`.
No código atual a inicialização usa `nativeTransport(window)`: para o novo alvo,
selecionar/injetar seu transporte antes de `app.js`, sem executar ambos nem
sobrescrever callbacks pendentes. Preserve a inicialização Android como padrão.

No Android, `catalogRequest(id, provider, path, paramsJson)` responde via
`window.CatalogNative.receive(id, envelope)`. No novo transporte, retornar a mesma
estrutura pública de resposta; os fixtures em `tests/catalog.test.cjs` são referência.
Manter IDs canônicos `movie:ID` / `tv:ID`, escalas das notas e semântica de paginação.

O transporte é responsável por HTTPS, allowlist de host/caminho/parâmetros, autenticação,
deduplicação, rate limiting, Retry-After, cancelamento de respostas antigas ao trocar
chaves, cache persistente e respostas stale em falhas temporárias. Não basta trocar
`catalogRequest` por `fetch`: as garantias Java não existem automaticamente no port.
Não afrouxar CORS nem expor chaves em proxy público para contornar restrições do SDK.

## Credenciais e persistência

BYOK por instalação, cadastro pelo controle, remoção/substituição no próprio aparelho.
O cofre só expõe presença/estado da chave, nunca o valor de volta à UI.
Usar armazenamento seguro público da plataforma, verificando disponibilidade e
permissões no modelo alvo. Se não houver proteção adequada, manter BYOK indisponível
e documentar o bloqueio; não gravar chaves em localStorage, JSON, manifest ou logs.
Criptografar com chave fixa embutida no JS não oferece um cofre seguro.

Favoritos atuais ficam em localStorage. Preservar seus identificadores e tema; planejar
migração explícita se mudar a origem WebView. Cache de dados e imagens deve ter limites
equivalentes aos existentes, sem autenticação persistida em URLs/metadados de diagnóstico.

## Aceitação e segurança

Separar capacidades confirmadas de pendências em PORT_PLAN.json. Testar indisponibilidade
de SDK, falha de armazenamento, troca de chave, expiração/cota e rede offline. Usar
credenciais fictícias em fixtures. Não habilitar autoatualização, instalar certificados
ou modificar configurações de uma TV como efeito de gerar a estrutura de port.
