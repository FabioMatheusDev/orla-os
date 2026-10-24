# Auditoria de credenciais no Git

Executada em 2026-10-23T21:50:17.848099+00:00

Escopo: todas as referências locais alcançáveis (`git rev-list --all`), 231 commits e 1219 blobs de até 4 MiB.
Busca por correspondência exata com as chaves pessoais locais conhecidas e por literais de API keys/tokens.

Nenhum valor, linha de código sensível, URL autenticada ou hash de chave é incluído neste relatório.

Resultado: nenhuma chave pessoal conhecida nem literal suspeito identificado no escopo analisado.

Limites: não cobre remotos não buscados, commits inalcançáveis/reflogs, objetos maiores, chaves desconhecidas ofuscadas, logs externos ou APKs antigos já distribuídos.
O config.js legado local tinha credencial pessoal; está fora do índice atual e agora é ignorado. O novo build o sanitiza e a nova instalação exige BYOK.
APKs anteriores podem conter a chave antiga; considere sua rotação se foram compartilhados. O novo build não reutiliza essa chave.

Auditoria anterior: [SECURITY_HISTORY.md](SECURITY_HISTORY.md) preserva uma ocorrência confirmada em checkpoint local.
Uma referência temporária pode mudar ou deixar de ser alcançável; um resultado atual vazio não invalida a exposição anterior nem a recomendação de revogação.
