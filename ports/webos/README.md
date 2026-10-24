# LG webOS

O APK não é usado. Reaproveitar `ui/` em um projeto webOS TV, implementando a ponte
com APIs públicas disponíveis. `appinfo.json.template` é apenas a referência de
metadados; falta ícone, integração e validação. Não copiar SDKs privados ou serviços
Luna restritos a apps de sistema para obter funções de launcher.

1. Confirmar modelo, firmware e versão do Web Engine. Avaliar JS/CSS e navegação
   por D-pad e Magic Remote, inclusive foco ao alternar ponteiro/controle.
2. Criar app pelo tooling oficial. Usar ID próprio e ícone antes de empacotar;
   manter o ponto de entrada na raiz do pacote final.
3. Implementar fachada assíncrona, teclado, ciclo de vida e abertura de apps por
   APIs autorizadas, com IDs webOS e capacidades explícitas.
4. Avaliar proteção de chaves disponível a um app de terceiros no alvo. A existência
   de um serviço de segurança na documentação não garante autorização para usá-lo.
   Se não houver cofre adequado, manter BYOK bloqueado até resolver.
5. Implementar HTTPS direto/CORS, allowlists, cache persistente limitado, cotas,
   paginação e recuperação offline. Não persistir chaves em localStorage.
6. Gerar `.ipk` e testar via Developer Mode/tooling oficial, observando as regras
   de sessão/instalação do modelo. Não supor que o app pode se tornar a Home da LG.

Fontes: [metadados appinfo.json](https://webostv.developer.lge.com/develop/references/appinfo-json),
[primeiro app e instalação](https://webostv.developer.lge.com/develop/getting-started/build-your-first-web-app).
