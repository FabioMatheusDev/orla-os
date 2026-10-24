"""Inspect decompressed APK entries without displaying credential values."""
import argparse
import json
import pathlib
import re
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--apk', type=pathlib.Path, default=ROOT / 'app/build/outputs/apk/debug/app-debug.apk')
parser.add_argument('--secrets', type=pathlib.Path, action='append', default=[], help='Private .env files; values are never printed')
args = parser.parse_args()
known = []
legacy = ROOT / 'app/src/main/assets/www/config.js'
if legacy.exists():
    known.extend(re.findall(r'(?:tmdbKey|mdblistKey)\s*:\s*[\'\"]([^\'\"]+)', legacy.read_text(encoding='utf-8')))
for source in args.secrets:
    for line in source.read_text(encoding='utf-8').splitlines():
        if line.startswith(('MDBLIST_API_KEY=', 'TMDB_API_KEY=', 'TMDB_READ_ACCESS_TOKEN=')):
            known.append(line.split('=', 1)[1].strip().strip('\"\''))
known = [value.encode() for value in known if len(value) >= 16 and not re.search(r'(?i)your_|example|placeholder', value)]
with zipfile.ZipFile(args.apk) as apk:
    entries = apk.namelist()
    matches = sum(any(secret in apk.read(entry) for secret in known) for entry in entries)
    public = apk.read('assets/www/config.js').decode()
    assert not re.search(r'(?i)tmdbKey|mdblistKey|api[_-]?key|access[_-]?token', public), 'Credential field in public config'
    assert not any(pathlib.PurePosixPath(entry).name.startswith('.env') for entry in entries), 'Environment file packaged'
    assert matches == 0, 'Known personal credential detected; values suppressed'
print(json.dumps({'apkEntries': len(entries), 'knownSecretsChecked': len(known), 'matches': matches, 'publicConfigSafe': True}))
