# Kit de preparação de ports da Home TV

Este kit dá um ponto de partida para adaptar a Home TV a outra plataforma. **Não é
uma versão funcional ou certificada para essas TVs.** O aplicativo Fire OS continua
na raiz; estes arquivos não são carregados nem empacotados no APK.

| Destino | Ponto de partida |
|---|---|
| Android TV / Google TV | [android-tv/README.md](android-tv/README.md): reaproveitar o projeto Android atual |
| Samsung Tizen | [tizen/README.md](tizen/README.md): UI compartilhada + integração Tizen |
| LG webOS | [webos/README.md](webos/README.md): UI compartilhada + integração webOS |
| Fire TV Vega OS | [vega/README.md](vega/README.md): UI reaproveitável + shell Vega |

webOS pertence à LG. Fire TV usa Fire OS ou Vega OS, conforme o modelo. Confirme
o sistema e a versão antes de escolher o destino; a marca da tela não basta.

## Começar um port

1. Preencha [REQUEST.md](REQUEST.md) e entregue ao desenvolvedor ou assistente.
2. Leia o guia do destino e [CONTRACT.md](CONTRACT.md).
3. Na raiz, execute um dos comandos:

```sh
node scripts/prepare-port.cjs android-tv
node scripts/prepare-port.cjs tizen
node scripts/prepare-port.cjs webos
node scripts/prepare-port.cjs vega
```

O comando gera uma pasta nova em `.local/ports/`, com plano de trabalho, contratos,
guia específico e, para os destinos não Android, uma cópia sanitizada da interface.
Não instala SDKs, não conecta à TV, não cria backend e não gera pacote instalável.
As configurações exportadas vêm de `config.example.js`, sem preferências pessoais.
Android TV recebe o plano para adaptar a raiz, sem duplicar o projeto Android.

Os manifests `.template` são referências incompletas: faltam identidade/certificados,
ícones e integrações. Não renomeie para anunciar um port pronto. A lista de pendências
fica em `PORT_PLAN.json`, com `readyToInstall: false`. Um port só pode mudar esse
estado após completar a validação em aparelho real.

## O que reaproveitar

- HTML/CSS, foco por D-pad, filtros, detalhes e favoritos em `app/src/main/assets/www/`.
- Regras de títulos/provedores e paginação de `catalog.js`, através de transporte próprio.
- Política de cache/cota/retry/allowlist como referência em `CatalogPolicy.java`,
  `CatalogNative.java`, `CatalogCache.java` e `CatalogImages.java`.
- Testes com fixtures em `tests/`. Acrescentar testes para o transporte e aparelho novos.

Não copie credenciais, keystores, `.local`, APKs antigos ou scripts de debloat.
Não use os scripts Fire OS para configurar outros sistemas. Preserve o Fire OS
funcionando enquanto o novo adaptador é desenvolvido. Não prometa substituir o Home
nem listar todos os apps se o SDK público da plataforma não permitir.

## Critério de conclusão

Compilar e assinar com identidade própria; instalar em modelo/firmware documentados;
validar D-pad e teclado, sinopse/elenco, favoritos, retomar/suspender, HTTPS/CORS,
armazenamento seguro de chaves, cache após reinício, paginação, 401/429/5xx e cota;
testar abertura de apps, Home/Voltar e restauração sem perda de dados onde suportados.
Capacidades indisponíveis devem ser ocultadas ou explicadas, nunca simuladas como reais.
Atualizar COMPATIBILITY.md com evidências e manter licenças/atribuição.
