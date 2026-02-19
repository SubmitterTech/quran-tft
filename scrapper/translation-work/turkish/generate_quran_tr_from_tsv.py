#!/usr/bin/env python3
"""Generate nested quran_tr-style JSON from TSV translation rows.

Behavior:
- Reads dotted keys from TSV (e.g. "23.sura.1.verses.1").
- Writes only rows with non-empty translation values.
- Does not apply English fallback.
- Supports array segments like "page[0]" and "tables[0].title[1]".
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from typing import Any

SEGMENT_RE = re.compile(r"^(?P<name>[^\[\]]+)(?:\[(?P<idx>\d+)\])?$")
MISSING = object()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build nested quran_tr-like JSON from TSV key/value rows."
    )
    parser.add_argument(
        "--input",
        default="source/turkish/yunusemre.tsv",
        help="Input TSV file path (default: source/turkish/yunusemre.tsv)",
    )
    parser.add_argument(
        "--output",
        default="source/turkish/quran_tr.json",
        help="Output JSON file path (default: source/turkish/quran_tr.json)",
    )
    parser.add_argument(
        "--key-column",
        default="key",
        help='TSV header name for key column (default: "key")',
    )
    parser.add_argument(
        "--translation-column",
        default="YENİSİ",
        help='TSV header name for translation column (default: "YENİSİ")',
    )
    parser.add_argument(
        "--translation-fallback-index",
        type=int,
        default=2,
        help="Fallback 0-based translation column index if header is missing (default: 2)",
    )
    return parser.parse_args()


def parse_segment(segment: str) -> tuple[str, int | None]:
    match = SEGMENT_RE.match(segment)
    if not match:
        raise ValueError(f"Invalid key segment: {segment}")
    name = match.group("name")
    idx = match.group("idx")
    return name, int(idx) if idx is not None else None


def parse_key(key: str) -> list[tuple[str, int | None]]:
    return [parse_segment(part) for part in key.split(".")]


def ensure_list_size(values: list[Any], idx: int) -> None:
    while len(values) <= idx:
        values.append(MISSING)


def set_path(root: dict[str, Any], key_parts: list[tuple[str, int | None]], value: str) -> None:
    current: Any = root

    for i, (name, idx) in enumerate(key_parts):
        is_last = i == len(key_parts) - 1

        if idx is None:
            if is_last:
                current[name] = value
                return

            next_node = current.get(name, MISSING)
            if next_node is MISSING:
                current[name] = {}
            elif not isinstance(next_node, dict):
                raise TypeError(f"Expected object at '{name}', got {type(next_node).__name__}")

            current = current[name]
            continue

        arr = current.get(name, MISSING)
        if arr is MISSING:
            current[name] = []
        elif not isinstance(arr, list):
            raise TypeError(f"Expected array at '{name}', got {type(arr).__name__}")

        arr = current[name]
        ensure_list_size(arr, idx)

        if is_last:
            arr[idx] = value
            return

        next_item = arr[idx]
        if next_item is MISSING:
            next_item = {}
            arr[idx] = next_item
        elif not isinstance(next_item, dict):
            raise TypeError(
                f"Expected object at '{name}[{idx}]', got {type(next_item).__name__}"
            )

        current = next_item


def compact(node: Any) -> Any:
    if node is MISSING:
        return MISSING

    if isinstance(node, dict):
        out_obj: dict[str, Any] = {}
        for key, value in node.items():
            cleaned = compact(value)
            if cleaned is MISSING:
                continue
            out_obj[key] = cleaned
        return out_obj if out_obj else MISSING

    if isinstance(node, list):
        cleaned_items = [compact(item) for item in node]
        present_indexes = [i for i, item in enumerate(cleaned_items) if item is not MISSING]
        if not present_indexes:
            return MISSING

        last = present_indexes[-1]
        out_list: list[Any] = []
        for item in cleaned_items[: last + 1]:
            out_list.append(None if item is MISSING else item)
        return out_list

    return node


def resolve_indexes(
    header: list[str],
    key_column: str,
    translation_column: str,
    fallback_translation_index: int,
) -> tuple[int, int]:
    normalized = [col.strip() for col in header]

    if key_column not in normalized:
        raise ValueError(f'Key column "{key_column}" not found in header: {normalized}')
    key_idx = normalized.index(key_column)

    if translation_column in normalized:
        return key_idx, normalized.index(translation_column)

    if fallback_translation_index < 0 or fallback_translation_index >= len(normalized):
        raise ValueError(
            f'Translation column "{translation_column}" not found and fallback index '
            f"{fallback_translation_index} is out of range."
        )
    return key_idx, fallback_translation_index


def normalize_translation(value: str) -> str:
    return value.replace("\\n", "\n").strip()


def main() -> int:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        raise FileNotFoundError(f"Input TSV not found: {input_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    nested: dict[str, Any] = {}
    rows_total = 0
    rows_written = 0
    rows_empty_key = 0
    rows_empty_translation = 0
    errors: list[tuple[int, str, str]] = []

    with input_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle, delimiter="\t")
        header = next(reader, None)
        if not header:
            raise ValueError("TSV is empty or missing header row.")

        key_idx, translation_idx = resolve_indexes(
            header=header,
            key_column=args.key_column,
            translation_column=args.translation_column,
            fallback_translation_index=args.translation_fallback_index,
        )

        for row_number, row in enumerate(reader, start=2):
            rows_total += 1

            key = row[key_idx].strip() if key_idx < len(row) else ""
            if not key:
                rows_empty_key += 1
                continue

            raw_translation = row[translation_idx] if translation_idx < len(row) else ""
            translation = normalize_translation(raw_translation)
            if not translation:
                rows_empty_translation += 1
                continue

            try:
                set_path(nested, parse_key(key), translation)
                rows_written += 1
            except Exception as exc:  # noqa: BLE001
                errors.append((row_number, key, str(exc)))

    output = compact(nested)
    if output is MISSING:
        output = {}

    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Input: {input_path}")
    print(f"Output: {output_path}")
    print(f"Rows processed: {rows_total}")
    print(f"Rows written: {rows_written}")
    print(f"Skipped (empty key): {rows_empty_key}")
    print(f"Skipped (empty translation): {rows_empty_translation}")
    print(f"Path/parse errors: {len(errors)}")
    if errors:
        for row_number, key, message in errors[:10]:
            print(f"- row {row_number}, key='{key}': {message}")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
