#!/usr/bin/env python3
"""Собрать переносимый комплект инструкций, проверить имена, UTF-8 и MCP-контракт."""
from pathlib import Path
import hashlib
import re
import shutil
import zipfile

root = Path(__file__).resolve().parent.parent
names = ["01 - ГР - НОРД - Курс и годовая цель.md", "02 - ГР - РИТМ - 12 недель и планы.md", "Как начать.md"]
sources = {name: (root / "project" / name).read_bytes() for name in names}
tool_source = (root / "app/mcp/route.ts").read_text(encoding="utf-8")
known_tools = set(re.findall(r'name: "(gruppa_rosta_v1_\w+)"', tool_source))
for name, content in sources.items():
    text = content.decode("utf-8")
    mentioned = set(re.findall(r"gruppa_rosta_v1_\w+", text))
    assert mentioned <= known_tools, f"Неизвестный инструмент в {name}: {mentioned - known_tools}"
    assert not re.search(r"appgprj_[a-z0-9]+|/Users/|ghp_[A-Za-z0-9]+", text), name
    if name[:2] in ("01", "02"):
        assert not re.search(r"\]\([^)]+\)", text), "Инструкция специалиста зависит от внешнего файла"
        assert "Версия инструкции: 0.3.0" in text
guide = sources["Как начать.md"].decode("utf-8")
for name in names[:2]:
    assert name in guide, "Порядок запуска ссылается на неверное имя файла"

destination = root / "outputs" / "project-0.3.0"
destination.mkdir(parents=True, exist_ok=True)
for name in names:
    shutil.copyfile(root / "project" / name, destination / name)
archive = root / "outputs" / "gruppa-rosta-project-0.3.0.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as package:
    for name, content in sources.items():
        info = zipfile.ZipInfo(name, date_time=(2026, 10, 30, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        package.writestr(info, content)
with zipfile.ZipFile(archive) as package:
    assert package.namelist() == names
    assert package.testzip() is None
    for info in package.infolist():
        assert info.flag_bits & 0x800, "Имя файла не помечено UTF-8"
        assert package.read(info.filename) == sources[info.filename]
print(f"Комплект проверен: {len(names)} файла; имена UTF-8, инструкции и MCP-контракт.")
print(f"ZIP: {archive.name}; SHA256: {hashlib.sha256(archive.read_bytes()).hexdigest()}")
