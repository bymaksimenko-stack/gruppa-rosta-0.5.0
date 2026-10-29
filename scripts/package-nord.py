"""Собрать переносимый ZIP НОРДа с корректными UTF-8 именами файлов."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
source = root / "plugins" / "gr-nord"
output = root / "outputs" / "gr-nord-0.1.0.zip"
output.parent.mkdir(parents=True, exist_ok=True)
manifest = json.loads((source / "plugin.json").read_text(encoding="utf-8"))
assert manifest["name"] == "gr-nord"
assert len(manifest["extensions"]["com.openai"]["interface"]["shortDescription"]) <= 30
files = sorted(path for path in source.rglob("*") if path.is_file())
assert not any(path.is_symlink() for path in files)
with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
    for path in files:
        archive.write(path, path.relative_to(source).as_posix())
with ZipFile(output) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == {path.relative_to(source).as_posix() for path in files}
    for path in files:
        assert archive.read(path.relative_to(source).as_posix()) == path.read_bytes()
print(f"Пакет проверен: {len(files)} файлов, русские имена сохранены, {output.stat().st_size} байт")
