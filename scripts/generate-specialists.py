#!/usr/bin/env python3
"""Собрать самостоятельные инструкции из полных авторских текстов без сокращений."""
from pathlib import Path
import argparse
import hashlib
import json

ROOT = Path(__file__).resolve().parent.parent
BEGIN = "<!-- НАЧАЛО ПОЛНОГО АВТОРСКОГО ПРОМПТА -->\n".encode("utf-8")
END = "<!-- КОНЕЦ ПОЛНОГО АВТОРСКОГО ПРОМПТА -->".encode("utf-8")


def documents():
    manifest = json.loads((ROOT / "prompts/manifest.json").read_text())
    for item in manifest["items"]:
        source = (ROOT / item["source"]).read_bytes()
        assert hashlib.sha256(source).hexdigest() == item["sha256"], "Изменен авторский исходник: " + item["source"]
        decoded = source.decode("utf-8")
        assert len(decoded) == item["characters"]
        assert len(decoded.splitlines()) == item["lines"]
        adapter = (ROOT / item["adapter"]).read_bytes().rstrip(b"\n")
        content = adapter + b"\n\n---\n\n" + BEGIN + source + b"\n" + END + b"\n"
        assert content.count(BEGIN) == 1 and content.count(END) == 1
        embedded = content.split(BEGIN, 1)[1].rsplit(b"\n" + END, 1)[0]
        assert embedded == source, "Авторский текст изменен при сборке"
        yield item, content


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Проверить, что рабочие файлы актуальны")
    args = parser.parse_args()
    for item, content in documents():
        target = ROOT / item["output"]
        if args.check:
            assert target.read_bytes() == content, "Пересоберите рабочий файл: " + item["output"]
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
        print(item["specialist"] + ": полный текст, " + str(item["characters"]) + " знаков, " + str(item["lines"]) + " строк; SHA256 совпал.")
