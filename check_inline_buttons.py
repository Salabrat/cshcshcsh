"""Точный аудит покрытия callback_data обработчиками (v2).

Учитывает: == "x", in [...], startswith("x"), а также любые упоминания
префикса в тексте декоратора (split/парсинг).
"""
import io
import re
import sys

if sys.platform == "win32":
    # Чтобы символы вроде ❌ не ломали вывод при перенаправлении в файл
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

FILES = ["keyboards.py", "streetshop.py", "bitpapa_handlers.py"]

produced = set()
for f in FILES:
    src = io.open(f, encoding="utf-8", errors="replace").read()
    for m in re.finditer(r"callback_data\s*=\s*[\"']([^\"']+)[\"']", src):
        produced.add(m.group(1))

src = io.open("streetshop.py", encoding="utf-8", errors="replace").read()

# 1) собираем полные тексты декораторов (с переносами строк)
decorators = []
lines = src.split("\n")
i = 0
while i < len(lines):
    if lines[i].lstrip().startswith("@dp.callback_query_handler"):
        buf = lines[i]
        depth = buf.count("(") - buf.count(")")
        while depth > 0 and i + 1 < len(lines):
            i += 1
            buf += " " + lines[i].strip()
            depth = buf.count("(") - buf.count(")")
        decorators.append(buf)
    i += 1

# 2) соберём все строковые литералы из фильтров + список startswith/==/in
literals = set()
for d in decorators:
    literals.update(re.findall(r"[\"']([^\"']+)[\"']", d))

starts = set()
equals = set()
inlists = set()
for d in decorators:
    starts.update(re.findall(r"startswith\(\s*[\"']([^\"']+)[\"']", d))
    equals.update(re.findall(r"c\.data\s*==\s*[\"']([^\"']+)[\"']", d))
    for grp in re.findall(r"c\.data\s+in\s+\[([^\]]*)\]", d):
        inlists.update(re.findall(r"[\"']([^\"']+)[\"']", grp))


def covered(cb):
    if cb in equals or cb in inlists:
        return True
    for s in starts:
        if cb.startswith(s):
            return True
    # динамический шаблон f"..._{x}" -> проверяем префикс до первой подстановки
    if "{" in cb:
        prefix = cb.split("{")[0]
        for s in starts:
            if s.startswith(prefix) or prefix.startswith(s):
                return True
    # «ручной» разбор в декораторе (split/индексы)
    for lit in literals:
        if lit == cb or (len(lit) > 4 and cb.startswith(lit)):
            return True
    return False


missing = sorted(c for c in produced if not covered(c))
print(f"callback_data: {len(produced)} | декораторов: {len(decorators)}")
print(f"startswith: {len(starts)} | ==: {len(equals)} | in[]: {len(inlists)}")
print(f"\n=== БЕЗ обработчика: {len(missing)} ===")
for m in missing:
    # где создаётся кнопка
    where = []
    for f in FILES:
        s = io.open(f, encoding="utf-8", errors="replace").read()
        for n, ln in enumerate(s.split("\n"), 1):
            if m in ln:
                where.append(f"{f}:{n}")
    print(f"  ! {m:45s} <- {', '.join(where[:3])}")