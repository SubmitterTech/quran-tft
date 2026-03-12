#!/usr/bin/env python3
"""List verse refs where Turkish text ends with a closing curly quote but original text does not."""

from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path

VERSE_KEY_RE = re.compile(r"^\d+\.sura\.(?P<sura>\d+)\.verses\.(?P<verse>\d+)$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Find TSV rows where column 2 does not end with ” but the last column does, "
            "then print verse refs like [31:24]."
        )
    )
    parser.add_argument(
        "--input",
        default="source/turkish/tu\u0308rkc\u0327e-c\u0327eviri-mehmet-yunusemre.tsv",
        help=(
            "Input TSV path "
            "(default: source/turkish/türkçe-çeviri-mehmet-yunusemre.tsv)"
        ),
    )
    return parser.parse_args()


def ends_with_closing_quote(value: str) -> bool:
    return value.rstrip().endswith("”")


def parse_ref(key: str) -> str:
    match = VERSE_KEY_RE.match(key.strip())
    if not match:
        return key.strip()
    return f"[{match.group('sura')}:{match.group('verse')}]"


def main() -> int:
    args = parse_args()
    input_path = Path(args.input)
    if not input_path.exists():
        raise FileNotFoundError(f"Input TSV not found: {input_path}")

    hits: list[str] = []

    with input_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle, delimiter="\t")
        next(reader, None)

        for row in reader:
            if len(row) < 3:
                continue

            key = row[0].strip()
            original = row[1]
            turkish = row[-1]

            if not key:
                continue

            if ends_with_closing_quote(turkish) and not ends_with_closing_quote(original):
                hits.append(parse_ref(key))

    for ref in hits:
        print(ref)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
