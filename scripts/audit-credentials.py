"""Read-only reachable Git-history audit. Never prints suspected values or matching lines."""
import datetime
import argparse
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
REPORT = ROOT / 'SECURITY_AUDIT.md'


def run(*args):
    return subprocess.run(['git', *args], cwd=ROOT, capture_output=True, check=True).stdout


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--secrets', type=pathlib.Path, action='append', default=[], help='Optional private .env files; values are never printed')
    args = parser.parse_args()
    # Exact personal key checks supplement assignment-pattern checks. Values stay in memory.
    known = []
    old = ROOT / 'app/src/main/assets/www/config.js'
    if old.exists():
        for value in re.findall(r'(?:tmdbKey|mdblistKey)\s*:\s*[\'\"]([^\'\"]+)', old.read_text(encoding='utf-8')):
            if len(value) >= 16:
                known.append(value.encode())
    for local in args.secrets:
        for line in local.read_text(encoding='utf-8').splitlines():
            if line.startswith(('MDBLIST_API_KEY=', 'TMDB_API_KEY=', 'TMDB_READ_ACCESS_TOKEN=')):
                value = line.split('=', 1)[1].strip()
                if len(value) >= 16:
                    known.append(value.encode())
    paths = {}
    for line in run('rev-list', '--objects', '--all').decode('utf-8', errors='replace').splitlines():
        parts = line.split(' ', 1)
        if len(parts) == 2:
            paths[parts[0]] = parts[1]
    hashes = list(paths)
    objects = run('cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)', *[]) if not hashes else subprocess.run(
        ['git', 'cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], cwd=ROOT,
        input=('\n'.join(hashes) + '\n').encode(), capture_output=True, check=True).stdout
    selected = []
    for row in objects.decode().splitlines():
        fields = row.split()
        if len(fields) == 3 and fields[1] == 'blob' and int(fields[2]) <= 4 * 1024 * 1024:
            selected.append(fields[0])
    process = subprocess.Popen(['git', 'cat-file', '--batch'], cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    findings = []
    assignment = re.compile(rb'(?i)(?:tmdb[_-]?(?:api[_-]?)?key|tmdbKey|mdblist[_-]?(?:api[_-]?)?key|mdblistKey|api[_-]?key|access[_-]?token)\s*[\"\']?\s*[:=]\s*[\"\']([A-Za-z0-9._~-]{24,1024})[\"\']')
    for sha in selected:
        process.stdin.write((sha + '\n').encode()); process.stdin.flush()
        header = process.stdout.readline().decode().split()
        body = process.stdout.read(int(header[2])); process.stdout.read(1)
        exact = any(secret in body for secret in known)
        candidates = [m[1] for m in assignment.finditer(body)]
        candidate = any(not re.search(rb'(?i)example|your_|placeholder|insert|replace|xxxx', c) for c in candidates)
        if exact or candidate:
            findings.append((sha, paths[sha], 'correspondência com chave pessoal' if exact else 'literal suspeito: revisão necessária'))
    process.stdin.close(); process.wait()
    refs = run('for-each-ref', '--format=%(refname)').decode().splitlines()
    references = {}
    for ref in refs:
        reachable = {line.split(' ', 1)[0] for line in run('rev-list', '--objects', ref).decode('utf-8', errors='replace').splitlines()}
        for sha, _, _ in findings:
            if sha in reachable:
                references.setdefault(sha, []).append(ref)
    commits = int(run('rev-list', '--all', '--count').decode().strip() or '0')
    lines = ['# Auditoria de credenciais no Git', '', 'Executada em ' + datetime.datetime.now(datetime.timezone.utc).isoformat(), '',
             f'Escopo: todas as referências locais alcançáveis (`git rev-list --all`), {commits} commits e {len(selected)} blobs de até 4 MiB.',
             'Busca por correspondência exata com as chaves pessoais locais conhecidas e por literais de API keys/tokens.', '',
             'Nenhum valor, linha de código sensível, URL autenticada ou hash de chave é incluído neste relatório.', '']
    if findings:
        lines += ['## Encontrados para revisão', '', '| Blob Git | Caminho | Motivo / referência |', '|---|---|---|']
        lines += [f'| `{sha}` | `{path}` | {reason}; ' + ', '.join('`' + ref + '`' for ref in references.get(sha, [])) + ' |' for sha, path, reason in findings]
        published = any(ref.startswith(('refs/heads/', 'refs/remotes/', 'refs/tags/')) for found in references.values() for ref in found)
        if not published:
            lines += ['', 'A ocorrência está em referência local de checkpoint/captura da ferramenta (refs/codex), não em branches, tags ou referências remotas analisadas. Não há evidência de commit/publicação dessa chave nas branches examinadas.']
        lines += ['', 'Se o literal for uma credencial real, revogue/rotacione-a no provedor. Remover o arquivo atual não apaga o histórico.',
                  'Não foi feita reescrita de histórico, remoção de commits ou alteração de remotos.']
    else:
        lines += ['Resultado: nenhuma chave pessoal conhecida nem literal suspeito identificado no escopo analisado.']
    lines += ['', 'Limites: não cobre remotos não buscados, commits inalcançáveis/reflogs, objetos maiores, chaves desconhecidas ofuscadas, logs externos ou APKs antigos já distribuídos.',
              'O config.js legado local tinha credencial pessoal; está fora do índice atual e agora é ignorado. O novo build o sanitiza e a nova instalação exige BYOK.',
              'APKs anteriores podem conter a chave antiga; considere sua rotação se foram compartilhados. O novo build não reutiliza essa chave.', '']
    if (ROOT / 'SECURITY_HISTORY.md').exists():
        lines += ['Auditoria anterior: [SECURITY_HISTORY.md](SECURITY_HISTORY.md) preserva uma ocorrência confirmada em checkpoint local.',
                  'Uma referência temporária pode mudar ou deixar de ser alcançável; um resultado atual vazio não invalida a exposição anterior nem a recomendação de revogação.', '']
    REPORT.write_text('\n'.join(lines), encoding='utf-8')
    print(json.dumps({'commits': commits, 'blobs': len(selected), 'findings': len(findings), 'report': 'SECURITY_AUDIT.md'}))


if __name__ == '__main__':
    main()
