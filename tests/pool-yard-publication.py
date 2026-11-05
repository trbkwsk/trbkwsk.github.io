"""Check the exact Pool Yard runtime closure before or after deployment."""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import json
from pathlib import Path
import re
import sys
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'manifests/pool-yard-publication.json').read_bytes())
records={r['path']:r for r in manifest['files']}
base=sys.argv[1].rstrip('/')+'/' if len(sys.argv)>1 else None


def check(row):
    path=row['path']
    assert path.startswith(('play/','manifests/','artifacts/'))
    assert Path(path).suffix.lower() not in {'.exe','.dll','.msh','.bnm','.ban','.st','.zip'}
    if base:
        request=Request(urljoin(base,path)+'?release='+row['sha256'][:12],headers={'Cache-Control':'no-cache'})
        with urlopen(request,timeout=35) as response:
            assert response.status==200,path
            blob=response.read()
    else:blob=(ROOT/path).read_bytes()
    assert len(blob)==row['bytes'] and sha256(blob).hexdigest()==row['sha256'],path
    return len(blob)


with ThreadPoolExecutor(max_workers=8) as pool:
    sizes=list(pool.map(check,manifest['files']))
html=(ROOT/'play/index.html').read_text()
for url in re.findall(r'(?:src|href)="([^"#]+)"',html):
    split=urlsplit(url)
    if split.path.endswith(('.js','.css')) and not split.scheme:
        path=urljoin('play/',split.path)
        assert path in records,path
        if split.query.startswith('v='):
            assert records[path]['sha256'].startswith(split.query[2:]),path
assert (ROOT/'sprayfight-legacy/index.html').is_file()
assert not manifest['raw_game_corpus_included']
print(json.dumps(dict(files=len(sizes),bytes=sum(sizes),hashes_match=True,
    remote=bool(base),legacy_preserved=True,browser_gpu_verified=False)))
