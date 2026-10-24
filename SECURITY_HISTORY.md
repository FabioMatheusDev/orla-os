# Auditoria de credenciais no Git

Executada em 2026-10-23T20:41:00.738288+00:00

Escopo: todas as referências locais alcançáveis (`git rev-list --all`), 231 commits e 1206 blobs de até 4 MiB.
Busca por correspondência exata com as chaves pessoais locais conhecidas e por literais de API keys/tokens.

Nenhum valor, linha de código sensível, URL autenticada ou hash de chave é incluído neste relatório.

## Encontrados para revisão

| Blob Git | Caminho | Motivo / referência |
|---|---|---|
| `2246662e1e7d3fadbc319247e8578847e0e7ca5d` | `docs/tv-home/app/src/main/assets/www/config.js` | correspondência com chave pessoal; `refs/codex/turn-diffs/captures/1792785443840/7b203c64-18f7-4080-9059-79e870c59432/base` |

A ocorrência está em referência local de checkpoint/captura da ferramenta (refs/codex), não em branches, tags ou referências remotas analisadas. Não há evidência de commit/publicação dessa chave nas branches examinadas.

Se o literal for uma credencial real, revogue/rotacione-a no provedor. Remover o arquivo atual não apaga o histórico.
Não foi feita reescrita de histórico, remoção de commits ou alteração de remotos.

Limites: não cobre remotos não buscados, commits inalcançáveis/reflogs, objetos maiores, chaves desconhecidas ofuscadas, logs externos ou APKs antigos já distribuídos.
O config.js legado local tinha credencial pessoal; está fora do índice atual e agora é ignorado. O novo build o sanitiza e a nova instalação exige BYOK.
APKs anteriores podem conter a chave antiga; considere sua rotação se foram compartilhados. O novo build não reutiliza essa chave.
