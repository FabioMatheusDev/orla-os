# Pedido para iniciar um port

Copie, preencha o que souber e entregue junto deste repositório. Não inclua API keys,
senhas, certificados ou IP público. IP local só é necessário na etapa de instalação.

```text
Quero adaptar a Home TV usando o kit ports/ deste repositório.

Destino: [Android TV / Google TV / Samsung Tizen / LG webOS / Fire TV Vega OS]
Marca e modelo exatos:
Ano do aparelho, se souber:
Sistema, versão e firmware:
Tenho aparelho para testar? [sim/não]
Computador para desenvolvimento: [Windows/macOS/Linux]
Modo de desenvolvedor/ADB disponível? [sim/não/não sei]
SDK/certificado de desenvolvimento disponível? [sim/não/não sei]
Preciso: [catálogo / apps / abrir streamings / substituir Home, se permitido]
Apps que quero abrir:
Instalação pretendida: [teste local / pacote para comunidade / loja oficial]

Leia AGENTS.md, COMPATIBILITY.md, ports/README.md, ports/CONTRACT.md e o guia do
destino antes de editar. Reaproveite o código atual e o plano gerado por
node scripts/prepare-port.cjs DESTINO. Não crie backend. Cada usuário cadastra
suas próprias chaves, guardadas com segurança no aparelho; nunca no código.
Não aceite armazenamento em texto puro como fallback silencioso. Se o SDK público
não oferecer proteção adequada, reporte o bloqueio antes de habilitar BYOK.

Primeiro identifique APIs públicas disponíveis, restrições e pendências do alvo.
Implemente o adaptador e empacotamento necessários, preservando o APK Fire OS.
Não confunda interface abrindo no navegador com port concluído. Não desative
serviços do sistema ou substitua Home sem suporte e autorização para a TV.
Peça apenas informações que não conseguir obter do projeto/aparelho autorizado.
Valide com fixtures e depois em aparelho real; registre as limitações.
```
