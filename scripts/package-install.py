#!/usr/bin/env python3
"""Чистый ZIP исходников для самостоятельной установки участником."""
from pathlib import Path, PurePosixPath
import subprocess, json, hashlib, zipfile
root=Path(__file__).resolve().parent.parent
version='0.5.0'
paths=subprocess.check_output(['git','ls-files','-z','--cached','--others','--exclude-standard'],cwd=root).decode().split('\0')
names=sorted(set(p for p in paths if p and (root/p).is_file()))
blocked={'.git','node_modules','outputs','work','dist','.next','.vinext','.wrangler','.sites-runtime','.codex'}
files={}
for name in names:
 p=PurePosixPath(name)
 assert not p.is_absolute() and '..' not in p.parts
 assert not any(x in blocked for x in p.parts), name
 assert not (root/name).is_symlink(), name
 assert not p.name.startswith(('.env','.dev.vars')), name
 files[name]=(root/name).read_bytes()
hosting=json.loads(files['.openai/hosting.json'])
assert 'project_id' not in hosting, 'Личная привязка в шаблоне'
for name, content in files.items():
 if Path(name).suffix.lower() in {'.png','.jpg','.jpeg','.ttf','.woff','.woff2','.zip'}: continue
 import re
 text=content.decode('utf-8')
 assert not re.search(r'(?:appgprj_|appgdep_|plugin_asdk_app_|libfile_)[a-z0-9]{16,}',text,re.I),name
 assert not re.search(r'gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}',text),name
manifest={'format':'gruppa-rosta-install','version':version,'files':{name:hashlib.sha256(b).hexdigest() for name,b in files.items()}}
files['SOURCE_MANIFEST.json']=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode()
out=root/'outputs';out.mkdir(exist_ok=True)
archive=out/f'gruppa-rosta-install-{version}.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for name,data in sorted(files.items()):
  info=zipfile.ZipInfo(name,(2026,10,30,0,0,0));info.external_attr=0o100644<<16;info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,data)
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 for name,data in files.items():assert z.read(name)==data
print(f'{archive.name}: {len(files)} files, {archive.stat().st_size} bytes')
print('SHA256:',hashlib.sha256(archive.read_bytes()).hexdigest())
