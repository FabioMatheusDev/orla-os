# Seletores dos filtros — 23/10/2026

Reproduzido corte do foco no seletor de tipo: a escala global 1.06 ultrapassava o
padding horizontal do scroll. O teste falhou antes da alteração. Os seletores agora
usam foco interno sem escala, borda de espessura constante e respiro no scroll.
Modal centralizado, altura limitada, vidro simulado estático, check da opção aplicada
e contador de posição. Cabeçalho e Cancelar ficam fora da área rolável.

Navegação do seletor passou a percorrer índices reais: listas longas não pulam para
Cancelar antes do fim. O scroll conserva margem superior/inferior do foco e Voltar
retorna ao filtro de origem. A seleção aplicada permanece distinta do item em foco.

Regressão no navegador passou para tipo, gênero, ordem, lista e ano nos temas Vidro
e Sólido; os 81 itens de ano foram percorridos para baixo e para cima, com verificação
geométrica do foco. Situação da série e reabertura com seleção anterior também foram
verificadas. Build debug e inspeção do APK passaram; instalado com atualização dos
dados preservados e setup-home executado. Testes de interface usam fixtures.
Na Fire TV AFTKM, os cinco seletores abriram sem recorte do foco e a navegação
percorreu os 81 itens de ano. Captura nativa via screencap conferida visualmente;
serviço Home permaneceu habilitado. Encaminhamento de depuração removido após o teste.

---

# Kit de ports — 23/10/2026

Criados guias para Android TV/Google TV, Tizen, webOS e Vega, contrato da ponte
existente, modelo de pedido e manifests de referência incompletos. O gerador
`scripts/prepare-port.cjs` gera entregas isoladas, com pendências explícitas,
`readyToInstall: false` e configuração de exemplo em vez de preferências pessoais.
Android TV reaproveita a raiz, sem duplicar o projeto. Nenhum adaptador incompleto
foi conectado ao runtime Android. Não houve instalação ou alteração da TV.

Teste com credenciais fictícias confirmou exclusão de segredos e arquivos privados,
rejeição de destino inválido sem criar saída, configuração pública de exemplo e
preservação de edições ao gerar novamente nos quatro destinos. Os 12 testes do
catálogo também passaram. A exportação foi executada para os quatro destinos reais
em .local/ports, ignorado pelo Git. Isso não certifica suporte aos novos sistemas.

---

# Limpeza para publicação — 23/10/2026

Home TV foi promovida de `docs/tv-home/` à raiz. Implementações antigas Canvas,
web/Tizen/webOS, site, ferramentas de debloat e diagnósticos foram retirados da
árvore e arquivados fora do repositório. Licença MIT e atribuições foram mantidas.
SDK ativo, caches e configurações locais permanecem ignorados; .git foi preservado.

Backup reversível: pasta irmã `HomeTV-backup-20261023-174625` (privada, não publicar).
`home-tv-before` guarda fontes/configuração anteriores; `legacy-root`, `legacy-docs`
e `local-tools-and-diagnostics` guardam os componentes retirados. Para reverter,
copiar as fontes anteriores para o caminho antigo e restaurar os itens arquivados;
não sobrescrever .git, chaves de assinatura ou dados da TV.

Validação após mover: builds debug e release sem assinatura, 12 testes de catálogo, 29 verificações da política
Java e teste de navegador passaram. Comparação de bytes de todos os arquivos em
app/src/main (exceto config.js privado) confirmou zero mudanças. Varredura de 60
arquivos públicos contra três credenciais conhecidas: zero correspondências.
Os dois APKs também foram inspecionados descompactados contra as três credenciais:
zero correspondências. Scripts PowerShell passaram na verificação de sintaxe.
config.js privado foi sanitizado, mantendo apenas opções públicas; original privado
está no backup. Nenhuma alteração na TV foi feita nesta limpeza.

Os scripts de restauração não usam mais pm clear: somente a opção explícita de
desinstalação remove dados. Scripts de debloat foram retirados. Releases deixaram
de usar assinatura debug; o distribuidor deve assinar seu APK fora do Git.
O CI foi preparado; sua execução no GitHub depende de publicação futura.
O remoto existente ainda aponta para o upstream; não houve push nem criação de repo.

A auditoria atual não encontrou segredos nas referências alcançáveis. A ocorrência
anterior permanece documentada em SECURITY_HISTORY.md, pois checkpoints temporários
podem mudar. Continua recomendável rotacionar a chave antiga.
Compatibilidade analisada em COMPATIBILITY.md. Não foram certificados novos aparelhos.

---

# Verificação da versão BYOK — 23/10/2026

Correção da navegação e revisão visual do Explorar Mais: teste de navegador com 40
cards, seis colunas e sete fileiras, nos temas Vidro e Sólido. Subida da última
fileira percorreu 30→24→18→12→6→0 e só depois entrou nos filtros; partindo do último
card, percorreu 39→33→27→21→15→9→3 antes de entrar nos filtros. Verificados também
paginação→última fileira, limite lateral e fileira final incompleta.
Os dois percursos foram repetidos no Fire TV com 40 títulos reais e passaram.
Captura da nova tela no aparelho conferida: filtros, grade, foco e paginação sem
sobreposição. Build e inspeção de segredos do APK passaram; atualizado via ADB e
setup-home executado, preservando o serviço. Referência visual: materiais e foco do
[tvOS / Apple HIG](https://developer.apple.com/design/human-interface-guidelines/materials),
com gradientes estáticos e animação de foco, sem blur contínuo.

Sombras e cota: 29 verificações da política Java passaram, incluindo limite de 1.000,
virada diária UTC e distinção entre limite diário e janela de cinco minutos. Navegador
verificou sombra em todos os cards e aviso de cota sem consumir requisições reais.
No Fire TV, uma consulta normal confirmou cabeçalhos da conta: limite 1.000 e saldo
982 naquele momento; contador local separado foi 13. O saldo é uma fotografia da
última resposta, não monitoramento contínuo de outros apps. Não foi esgotada a cota.

Home: gravação anterior detectou duas telas pretas de 0,52 s e 0,42 s nos cenários
Home já visível e retorno das Configurações. A primeira experiência posterior variou
até 0,95 s por ADB; portanto não comprova ganho quantitativo de tempo de tela preta.
O usuário relatou melhora parcial pelo controle físico, ainda passando pela Amazon.
Os logs confirmam reaproveitamento por onNewIntent, sem novo onCreate durante os
retornos, e só a rota de evento de janela foi observada nesse teste. Mesmo com
filtro de teclas explicitamente habilitado em runtime, Home físico continuou passando
pela Amazon. O usuário confirmou nova melhora parcial no segundo teste. Os dois últimos
retornos da sessão anterior retomaram a atividade 110 ms e 169 ms após o evento de janela; esse intervalo
não inclui o processamento anterior feito pelo Fire OS nem garante primeiro quadro.
O comando oficial set-home-activity retornou Success, mas resolve-activity continuou
selecionando o launcher Amazon de prioridade 950. A preferência original foi reaplicada.
O filtro global sem efeito foi removido da versão final. Permaneceram notificação
sem atraso, reaproveitamento de atividade, supressão de retornos duplicados, animações
locais desativadas e varredura de apps adiada. Na versão final, um retorno por ADB
levou 331 ms do evento de janela até onResume, confirmando variação sob carga e
sem novo onCreate. O serviço segue habilitado, com capabilities=0 e timeout=0,
e a Amazon ativa. Não foi atingido o objetivo de eliminar totalmente a passagem preta.

Exploração ampliada e favoritos: 12 testes de catálogo passaram, incluindo tipos
mistos, mapeamento de gêneros, janela de lançamentos, critérios de qualidade e
fallback da lista oficial de mais assistidos. Teste de navegador passou pelo card
final Explorar mais, filtros, paginação, favoritos no cabeçalho sem sobreposição,
coração vermelho/vazio e remoção imediata da lista ao retornar dos detalhes.

Atualização visual: rodapé técnico transferido para a configuração de chaves;
cards com somente Detalhes; botões separados da sinopse/elenco; sinopse sem limite
de três linhas, com rolagem pelo D-pad; Netflix vetorial vermelho sobre preto.
Testes de interface passaram com sinopse longa, seis pessoas no elenco,
favoritar, Trailer, temporadas, retorno de foco e ausência de sobreposição.
Instalado e conferido no Fire TV com um título real: Detalhes abriu, seis nomes
carregaram, sinopse sem clamp, botões separados; fontes e atualização conferidas
visualmente no diálogo nativo. Credenciais existentes preservadas.

## Verificado

- `node --check app/src/main/assets/www/app.js`: passou.
- `assembleDebug`: passou, Android SDK 34, pacote `com.tvhome.launcher`, versão `1.1-byok`.
- 10 testes Node: IDs canônicos, escalas de notas, paginação MDBList e TMDB sem perder
  títulos entre páginas, deduplicação, falhas, fallback de provedor, idioma/região,
  filtros e transporte sem exposição de chaves.
- 22 verificações Java da política nativa: rotas, parâmetros, cotas, TTL e falhas transitórias.
- Navegador Chrome com fixtures: foco Sólido, Detalhes por D-pad/OK, avaliações,
  descoberta, retorno ao foco e temporadas/episódios. Sem consumo de API.
- APK inspecionado descompactado: nenhuma correspondência com as chaves pessoais
  conhecidas; configuração pública sem campos de credenciais e sem arquivos .env.
- Instalado no Fire TV AFTKM, Android 11 / Fire OS 8.1.8.5. Home TV voltou ao primeiro
  plano com o botão Home; serviço de acessibilidade existente preservado.
- No aparelho: cifrar/decifrar credencial fictícia pelo Keystore, confirmar armazenamento
  cifrado, remover a credencial de teste, reabrir cache persistente e respeitar limite
  de tamanho. As cinco verificações passaram. Nenhuma chave pessoal foi cadastrada.
- Captura da tela inicial no aparelho conferida; aplicativos e Prime Video acessíveis.
- Auditoria de Git: ocorrência da chave TMDB antiga apenas em checkpoint local no
  escopo analisado. Ver [relatório](SECURITY_AUDIT.md).

## Limites da verificação

As consultas autenticadas na versão instalada aguardam as chaves cadastradas pelo
usuário no controle remoto. Os contratos MDBList foram conferidos com consultas
controladas durante o desenvolvimento; os testes automatizados usam fixtures.
Não foi interrompida a rede física da TV, nem esgotada a cota real dos provedores.
O cache persistente foi testado no aparelho; as classificações de falha e comportamento
da interface foram testados separadamente. Não há medição comparável de desempenho
antes/depois, nem promessa de ganho de memória ou taxa de quadros.

O Gradle emitiu aviso de licença de Platform-Tools no SDK local, sem impedir o build.
A instalação utilizou o ADB já disponível. Não foram alterados serviços da Amazon,
configuração de rede, histórico Git ou remotos.
