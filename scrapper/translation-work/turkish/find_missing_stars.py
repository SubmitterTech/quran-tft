#!/usr/bin/env python3
"""List verse refs where original text contains * but Turkish text does not."""

from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path

VERSE_KEY_RE = re.compile(r"^\d+\.sura\.(?P<sura>\d+)\.verses\.(?P<verse>\d+)$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Find TSV rows where column 2 contains * but the last column does not, "
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


def parse_ref(key: str) -> str:
    match = VERSE_KEY_RE.match(key.strip())
    if not match:
        return key.strip()
    return f"[{match.group('sura')}:{match.group('verse')}]"


def resolve_indexes(header: list[str]) -> tuple[int, int, int]:
    normalized = [cell.strip() for cell in header]
    meaningful = [idx for idx, cell in enumerate(normalized) if cell]
    if len(meaningful) < 3:
        raise ValueError(f"Expected at least 3 non-empty columns, got: {normalized}")
    return meaningful[0], meaningful[1], meaningful[-1]


def main() -> int:
    args = parse_args()
    input_path = Path(args.input)
    if not input_path.exists():
        raise FileNotFoundError(f"Input TSV not found: {input_path}")

    hits: list[str] = []

    with input_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle, delimiter="\t")
        header = next(reader, None)
        if not header:
            raise ValueError("TSV is empty or missing header row.")

        key_idx, original_idx, turkish_idx = resolve_indexes(header)

        for row in reader:
            if len(row) <= max(key_idx, original_idx, turkish_idx):
                continue

            key = row[key_idx].strip()
            original = row[original_idx]
            turkish = row[turkish_idx]

            if not key:
                continue

            if "*" in original and "*" not in turkish:
                hits.append(parse_ref(key))

    for ref in hits:
        print(ref)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
