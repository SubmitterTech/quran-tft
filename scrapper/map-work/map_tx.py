import argparse
import copy
import csv
import hashlib
import json
import os
import re


DEFAULT_HASH_LENGTH = 40
INVISIBLE_BLANK_CHARS = "\u200b\u200c\u200d\ufeff"


def load_json(path):
    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def write_json(path, data, sort_keys=False):
    with open(path, "w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=4, sort_keys=sort_keys)
        file.write("\n")


def walk_map(data, path=None):
    if path is None:
        path = []

    if isinstance(data, dict):
        for key, value in data.items():
            yield from walk_map(value, path + [key])
    elif isinstance(data, str):
        yield path, data
    else:
        raise TypeError(f"Unsupported map value at {' > '.join(path)}: {type(data).__name__}")


def stable_path_id(path, hash_length=DEFAULT_HASH_LENGTH):
    canonical_path = json.dumps(path, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha1(canonical_path.encode("utf-8")).hexdigest()[:hash_length]


def make_tx_key(path, reference, hash_length=DEFAULT_HASH_LENGTH):
    readable_reference = reference.strip() or "empty"
    return f"{readable_reference}__{stable_path_id(path, hash_length)}"


def build_export(map_data, source_path, hash_length=DEFAULT_HASH_LENGTH):
    flat = {}
    items = []
    seen_keys = {}

    for order, (path, reference) in enumerate(walk_map(map_data)):
        tx_key = make_tx_key(path, reference, hash_length)
        previous_path = seen_keys.get(tx_key)
        if previous_path is not None and previous_path != path:
            raise ValueError(
                "Transifex key collision. Increase HASH_LENGTH before exporting: "
                f"{tx_key} maps to both {previous_path!r} and {path!r}"
            )
        seen_keys[tx_key] = path

        flat[tx_key] = "\n".join(path)
        items.append({
            "key": tx_key,
            "order": order,
            "source_path": path,
            "reference": reference,
        })

    manifest = {
        "version": 1,
        "kind": "quran-tft-map-tx-manifest",
        "generated_by": "map_tx.py export",
        "source": os.path.normpath(source_path),
        "hash_length": hash_length,
        "item_count": len(items),
        "items": items,
    }
    return flat, manifest


def parse_reference_sort_key(reference):
    reference = reference.strip()
    match = re.match(r"(\d+)(?::(\d+))?", reference)
    if not match:
        return (float("inf"), float("inf"), reference)
    chapter = int(match.group(1))
    verse = int(match.group(2)) if match.group(2) else 0
    return (chapter, verse, reference)


def split_references(reference):
    return [part.strip() for part in reference.split(";") if part.strip()]


def merge_references(*references):
    seen = set()
    parts = []
    for reference in references:
        for part in split_references(reference):
            if part not in seen:
                seen.add(part)
                parts.append(part)
    return "; ".join(sorted(parts, key=parse_reference_sort_key))


def translated_path_for(item, flat_data, fallback_to_source):
    tx_key = item["key"]
    value = flat_data.get(tx_key)

    if value is None:
        if not fallback_to_source:
            raise KeyError(f"Missing translation key: {tx_key}")
        return item["source_path"]

    if not isinstance(value, str):
        raise TypeError(f"Translation value for {tx_key} must be a string")

    levels = value.split("\n")
    if not levels:
        if not fallback_to_source:
            raise ValueError(f"Translation value for {tx_key} has no path segments")
        return item["source_path"]
    return levels


def set_leaf(root, path, reference):
    current = root
    for index, part in enumerate(path):
        is_last = index == len(path) - 1

        if is_last:
            existing = current.get(part)
            if existing is None:
                current[part] = reference
            elif isinstance(existing, dict):
                existing[""] = merge_references(existing.get("", ""), reference)
            else:
                current[part] = merge_references(existing, reference)
            return

        existing = current.get(part)
        if existing is None:
            current[part] = {}
        elif not isinstance(existing, dict):
            current[part] = {"": existing}
        current = current[part]


def reconstruct_map(flat_data, manifest, fallback_to_source=False):
    items = manifest.get("items", [])
    if not isinstance(items, list):
        raise ValueError("Manifest must contain an items list")

    reconstructed = {}
    for item in sorted(items, key=lambda entry: entry["order"]):
        path = translated_path_for(item, flat_data, fallback_to_source)
        set_leaf(reconstructed, path, item["reference"])

    return reconstructed


def path_depth(path):
    return len(path) if path else 0


def path_leaf(path):
    if not path:
        return ""
    return path[-1]


def path_for_report(path):
    return " > ".join(path)


def strip_invisible_blank_chars(value):
    for char in INVISIBLE_BLANK_CHARS:
        value = value.replace(char, "")
    return value


def is_blank_translation_value(value):
    if not isinstance(value, str):
        return False
    cleaned = strip_invisible_blank_chars(value)
    return not any(part.strip() for part in cleaned.split("\n"))


def normalized_path_value(value):
    if not isinstance(value, str):
        return []
    return [strip_invisible_blank_chars(part).strip() for part in value.split("\n")]


def path_from_report(value):
    return [part.strip() for part in value.split(" > ") if part.strip()]


def write_tsv(path, rows, fieldnames):
    with open(path, "w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames, delimiter="\t")
        writer.writeheader()
        writer.writerows(rows)


def group_items_by_reference(manifest):
    groups = {}
    for item in sorted(manifest["items"], key=lambda entry: entry["order"]):
        reference = item["reference"].strip()
        if not reference:
            continue
        groups.setdefault(reference, []).append(item)
    return groups


def build_legacy_items(map_data, hash_length=DEFAULT_HASH_LENGTH):
    items = []
    reference_counts = {}
    empty_count = 0

    for order, (path, reference) in enumerate(walk_map(map_data)):
        cleaned_reference = reference.strip()
        if cleaned_reference:
            duplicate_index = reference_counts.get(cleaned_reference, 0)
            reference_counts[cleaned_reference] = duplicate_index + 1
            legacy_key = f"{duplicate_index}__{cleaned_reference}"
        else:
            empty_count += 1
            duplicate_index = ""
            legacy_key = f"empty_{empty_count}"

        items.append({
            "legacy_key": legacy_key,
            "duplicate_index": duplicate_index,
            "order": order,
            "source_path": path,
            "reference": cleaned_reference,
            "new_key": make_tx_key(path, cleaned_reference, hash_length),
        })

    return items


def set_reference_at_path(data, path, reference):
    current = data
    for part in path[:-1]:
        current = current[part]
    current[path[-1]] = reference


def key_by_source_path(manifest):
    return {tuple(item["source_path"]): item["key"] for item in manifest["items"]}


def stability_check_command(args):
    source_data = load_json(args.source)
    _, base_manifest = build_export(source_data, args.source, args.hash_length)
    base_keys = key_by_source_path(base_manifest)
    duplicate_groups = group_items_by_reference(base_manifest)
    duplicate_groups = {
        reference: items
        for reference, items in duplicate_groups.items()
        if len(items) > 1
    }

    failures = []
    mutation_count = 0
    checked_unchanged_paths = 0

    for reference, items in sorted(duplicate_groups.items()):
        for changed_item in items:
            mutation_count += 1
            changed_path = changed_item["source_path"]
            mutated = copy.deepcopy(source_data)
            changed_reference = f"{reference} [stability-check changed {mutation_count}]"
            set_reference_at_path(mutated, changed_path, changed_reference)
            _, mutated_manifest = build_export(mutated, args.source, args.hash_length)
            mutated_keys = key_by_source_path(mutated_manifest)

            for item in items:
                path_tuple = tuple(item["source_path"])
                if item["source_path"] == changed_path:
                    continue
                checked_unchanged_paths += 1
                old_key = base_keys[path_tuple]
                new_key = mutated_keys.get(path_tuple)
                if old_key != new_key:
                    failures.append({
                        "reference": reference,
                        "changed_path": path_for_report(changed_path),
                        "shifted_path": path_for_report(item["source_path"]),
                        "old_key": old_key,
                        "new_key": new_key,
                    })

    result = {
        "source": os.path.normpath(args.source),
        "duplicate_reference_group_count": len(duplicate_groups),
        "duplicate_reference_entry_count": sum(len(items) for items in duplicate_groups.values()),
        "mutation_count": mutation_count,
        "checked_unchanged_path_count": checked_unchanged_paths,
        "failure_count": len(failures),
        "failures": failures,
    }

    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        write_json(args.out, result)

    print(f"Duplicate reference groups:   {result['duplicate_reference_group_count']}")
    print(f"Duplicate reference entries:  {result['duplicate_reference_entry_count']}")
    print(f"Mutations tested:             {result['mutation_count']}")
    print(f"Unchanged paths checked:      {result['checked_unchanged_path_count']}")
    print(f"Key shift failures:           {result['failure_count']}")
    if args.out:
        print(f"Report:                       {args.out}")
    if failures:
        raise SystemExit(1)


def indexed_report_command(args):
    source_data = load_json(args.source)
    translated_data = load_json(args.translation)

    source_flat, source_manifest = build_export(source_data, args.source, args.hash_length)
    translated_flat, translated_manifest = build_export(translated_data, args.translation, args.hash_length)

    source_groups = group_items_by_reference(source_manifest)
    translated_groups = group_items_by_reference(translated_manifest)
    duplicate_references = sorted(
        reference for reference, items in source_groups.items()
        if len(items) > 1
    )

    common_rows = []
    missing_rows = []
    extra_rows = []
    group_rows = []

    for reference in duplicate_references:
        source_items = source_groups[reference]
        translated_items = translated_groups.get(reference, [])
        common_count = min(len(source_items), len(translated_items))

        group_rows.append({
            "reference": reference,
            "legacy_indexed_key_count": len(source_items),
            f"{args.lang}_indexed_key_count": len(translated_items),
            "common_indexed_key_count": common_count,
            "count_match": len(source_items) == len(translated_items),
        })

        for index in range(common_count):
            source_item = source_items[index]
            translated_item = translated_items[index]
            source_path = source_item["source_path"]
            translated_path = translated_item["source_path"]
            common_rows.append({
                "legacy_key": f"{index}__{reference}",
                "duplicate_index": index,
                "reference": reference,
                "source_new_key": source_item["key"],
                f"{args.lang}_new_key": translated_item["key"],
                "source_path": path_for_report(source_path),
                f"{args.lang}_path": path_for_report(translated_path),
                "source_leaf": path_leaf(source_path),
                f"{args.lang}_leaf": path_leaf(translated_path),
                "source_depth": path_depth(source_path),
                f"{args.lang}_depth": path_depth(translated_path),
                "depth_match": path_depth(source_path) == path_depth(translated_path),
                "group_count_match": len(source_items) == len(translated_items),
            })

        for index in range(common_count, len(source_items)):
            source_item = source_items[index]
            source_path = source_item["source_path"]
            missing_rows.append({
                "legacy_key": f"{index}__{reference}",
                "duplicate_index": index,
                "reference": reference,
                "source_new_key": source_item["key"],
                "source_path": path_for_report(source_path),
                "source_leaf": path_leaf(source_path),
                "source_depth": path_depth(source_path),
            })

        for index in range(common_count, len(translated_items)):
            translated_item = translated_items[index]
            translated_path = translated_item["source_path"]
            extra_rows.append({
                "legacy_key": f"{index}__{reference}",
                "duplicate_index": index,
                "reference": reference,
                f"{args.lang}_new_key": translated_item["key"],
                f"{args.lang}_path": path_for_report(translated_path),
                f"{args.lang}_leaf": path_leaf(translated_path),
                f"{args.lang}_depth": path_depth(translated_path),
            })

    os.makedirs(args.out_dir, exist_ok=True)
    source_reverse_path = os.path.join(args.out_dir, "source_new_reversed.json")
    translated_reverse_path = os.path.join(args.out_dir, f"{args.lang}_new_reversed.json")
    source_manifest_path = os.path.join(args.out_dir, "source_new_manifest.json")
    translated_manifest_path = os.path.join(args.out_dir, f"{args.lang}_new_manifest.json")
    common_tsv_path = os.path.join(args.out_dir, "indexed_common_keys.tsv")
    common_json_path = os.path.join(args.out_dir, "indexed_common_keys.json")
    missing_tsv_path = os.path.join(args.out_dir, f"indexed_missing_in_{args.lang}.tsv")
    extra_tsv_path = os.path.join(args.out_dir, f"indexed_extra_in_{args.lang}.tsv")
    groups_tsv_path = os.path.join(args.out_dir, "indexed_reference_groups.tsv")
    summary_path = os.path.join(args.out_dir, "summary.json")

    write_json(source_reverse_path, source_flat, sort_keys=True)
    write_json(translated_reverse_path, translated_flat, sort_keys=True)
    write_json(source_manifest_path, source_manifest)
    write_json(translated_manifest_path, translated_manifest)
    write_json(common_json_path, common_rows)

    common_fields = [
        "legacy_key",
        "duplicate_index",
        "reference",
        "source_new_key",
        f"{args.lang}_new_key",
        "source_path",
        f"{args.lang}_path",
        "source_leaf",
        f"{args.lang}_leaf",
        "source_depth",
        f"{args.lang}_depth",
        "depth_match",
        "group_count_match",
    ]
    missing_fields = [
        "legacy_key",
        "duplicate_index",
        "reference",
        "source_new_key",
        "source_path",
        "source_leaf",
        "source_depth",
    ]
    extra_fields = [
        "legacy_key",
        "duplicate_index",
        "reference",
        f"{args.lang}_new_key",
        f"{args.lang}_path",
        f"{args.lang}_leaf",
        f"{args.lang}_depth",
    ]
    group_fields = [
        "reference",
        "legacy_indexed_key_count",
        f"{args.lang}_indexed_key_count",
        "common_indexed_key_count",
        "count_match",
    ]

    write_tsv(common_tsv_path, common_rows, common_fields)
    write_tsv(missing_tsv_path, missing_rows, missing_fields)
    write_tsv(extra_tsv_path, extra_rows, extra_fields)
    write_tsv(groups_tsv_path, group_rows, group_fields)

    summary = {
        "source": os.path.normpath(args.source),
        "translation": os.path.normpath(args.translation),
        "language": args.lang,
        "source_new_key_count": len(source_flat),
        "translation_new_key_count": len(translated_flat),
        "source_duplicate_reference_group_count": len(duplicate_references),
        "indexed_common_key_count": len(common_rows),
        "indexed_missing_in_translation_count": len(missing_rows),
        "indexed_extra_in_translation_count": len(extra_rows),
        "group_count_mismatch_count": sum(1 for row in group_rows if not row["count_match"]),
        "depth_mismatch_count": sum(1 for row in common_rows if not row["depth_match"]),
        "files": {
            "source_new_reversed": source_reverse_path,
            "translation_new_reversed": translated_reverse_path,
            "source_new_manifest": source_manifest_path,
            "translation_new_manifest": translated_manifest_path,
            "indexed_common_keys_tsv": common_tsv_path,
            "indexed_common_keys_json": common_json_path,
            "indexed_missing_in_translation_tsv": missing_tsv_path,
            "indexed_extra_in_translation_tsv": extra_tsv_path,
            "indexed_reference_groups_tsv": groups_tsv_path,
        },
    }
    write_json(summary_path, summary)

    print(f"Source new keys:             {len(source_flat)}")
    print(f"{args.lang} new keys:                 {len(translated_flat)}")
    print(f"Duplicate reference groups:  {len(duplicate_references)}")
    print(f"Indexed common keys:         {len(common_rows)}")
    print(f"Indexed missing in {args.lang}:       {len(missing_rows)}")
    print(f"Indexed extra in {args.lang}:         {len(extra_rows)}")
    print(f"Group count mismatches:      {summary['group_count_mismatch_count']}")
    print(f"Depth mismatches:            {summary['depth_mismatch_count']}")
    print(f"Output directory:            {args.out_dir}")


def legacy_shift_report_command(args):
    source_data = load_json(args.source)
    legacy_translation = load_json(args.legacy_translation)
    source_items = build_legacy_items(source_data, args.hash_length)

    source_groups = {}
    for item in source_items:
        reference = item["reference"]
        if reference:
            source_groups.setdefault(reference, []).append(item)

    duplicate_references = {
        reference
        for reference, items in source_groups.items()
        if len(items) > 1
    }
    source_by_legacy_key = {item["legacy_key"]: item for item in source_items}
    source_by_reference_path = {
        (item["reference"], tuple(item["source_path"])): item
        for item in source_items
    }
    source_by_reference_leaf = {}
    for item in source_items:
        leaf = path_leaf(item["source_path"])
        source_by_reference_leaf.setdefault((item["reference"], leaf), []).append(item)

    suspect_rows = []
    all_duplicate_rows = []
    missing_rows = []
    extra_rows = []

    for item in source_items:
        reference = item["reference"]
        if reference not in duplicate_references:
            continue

        legacy_value = legacy_translation.get(item["legacy_key"])
        if legacy_value is None:
            row = {
                "issue": "missing_in_legacy_translation",
                "suggested_action": "manual_review_missing_legacy_key",
                "legacy_key": item["legacy_key"],
                "reference": reference,
                "source_new_key": item["new_key"],
                "source_path": path_for_report(item["source_path"]),
                "source_depth": path_depth(item["source_path"]),
                f"{args.lang}_legacy_path": "",
                f"{args.lang}_depth": "",
                "matched_source_legacy_key": "",
                "matched_source_new_key": "",
                "matched_source_path": "",
                "note": "Legacy translation JSON does not contain this current source key.",
            }
            suspect_rows.append(row)
            missing_rows.append(row)
            continue

        if not isinstance(legacy_value, str):
            raise TypeError(f"Legacy translation value for {item['legacy_key']} must be a string")

        if is_blank_translation_value(legacy_value):
            row = {
                "issue": "blank_legacy_translation",
                "suggested_action": "omit_untranslated_value",
                "legacy_key": item["legacy_key"],
                "reference": reference,
                "source_new_key": item["new_key"],
                "source_path": path_for_report(item["source_path"]),
                "source_depth": path_depth(item["source_path"]),
                f"{args.lang}_legacy_path": "",
                f"{args.lang}_depth": "",
                "matched_source_legacy_key": "",
                "matched_source_new_key": "",
                "matched_source_path": "",
                "note": "Legacy translation value is blank and will be omitted from stable upload JSON.",
            }
            all_duplicate_rows.append(row)
            continue

        translated_path = legacy_value.split("\n")
        exact_match = source_by_reference_path.get((reference, tuple(translated_path)))
        leaf_matches = source_by_reference_leaf.get((reference, path_leaf(translated_path)), [])
        other_leaf_matches = [
            match for match in leaf_matches
            if match["legacy_key"] != item["legacy_key"]
        ]

        issues = []
        notes = []
        if exact_match and exact_match["legacy_key"] != item["legacy_key"]:
            issues.append("translation_path_is_another_source_path")
            notes.append(
                "The legacy translation value exactly matches a different English source "
                "path in this duplicate-reference group."
            )
        if path_depth(translated_path) != path_depth(item["source_path"]):
            issues.append("depth_mismatch")
            notes.append(
                "The translated path depth differs from the current source path depth."
            )
        if exact_match and exact_match["legacy_key"] == item["legacy_key"]:
            issues.append("untranslated_exact_source_path")
            notes.append("The translation is still the exact English source path.")
        if exact_match and exact_match["legacy_key"] != item["legacy_key"]:
            suggested_action = "move_or_review_under_matched_source_key"
        elif issues:
            suggested_action = "manual_review"
        else:
            suggested_action = "no_action_detected"

        row = {
            "issue": ";".join(issues) or "translated_or_no_automatic_shift_signal",
            "suggested_action": suggested_action,
            "legacy_key": item["legacy_key"],
            "reference": reference,
            "source_new_key": item["new_key"],
            "source_path": path_for_report(item["source_path"]),
            "source_depth": path_depth(item["source_path"]),
            f"{args.lang}_legacy_path": path_for_report(translated_path),
            f"{args.lang}_depth": path_depth(translated_path),
            "matched_source_legacy_key": exact_match["legacy_key"] if exact_match else "",
            "matched_source_new_key": exact_match["new_key"] if exact_match else "",
            "matched_source_path": path_for_report(exact_match["source_path"]) if exact_match else "",
            "note": " ".join(notes),
        }
        all_duplicate_rows.append(row)
        if issues and issues != ["untranslated_exact_source_path"]:
            suspect_rows.append(row)

    for legacy_key, legacy_value in legacy_translation.items():
        if legacy_key in source_by_legacy_key or "__" not in legacy_key:
            continue
        reference = legacy_key.split("__", 1)[1]
        if reference not in duplicate_references:
            continue
        if not isinstance(legacy_value, str):
            raise TypeError(f"Legacy translation value for {legacy_key} must be a string")
        translated_path = legacy_value.split("\n")
        row = {
            "issue": "extra_in_legacy_translation",
            "suggested_action": "manual_review_extra_legacy_key",
            "legacy_key": legacy_key,
            "reference": reference,
            "source_new_key": "",
            "source_path": "",
            "source_depth": "",
            f"{args.lang}_legacy_path": path_for_report(translated_path),
            f"{args.lang}_depth": path_depth(translated_path),
            "matched_source_legacy_key": "",
            "matched_source_new_key": "",
            "matched_source_path": "",
            "note": "Legacy translation JSON contains a key that current source no longer has.",
        }
        suspect_rows.append(row)
        extra_rows.append(row)

    fields = [
        "issue",
        "suggested_action",
        "legacy_key",
        "reference",
        "source_new_key",
        "source_path",
        "source_depth",
        f"{args.lang}_legacy_path",
        f"{args.lang}_depth",
        "matched_source_legacy_key",
        "matched_source_new_key",
        "matched_source_path",
        "note",
    ]

    os.makedirs(args.out_dir, exist_ok=True)
    suspects_path = os.path.join(args.out_dir, f"{args.lang}_legacy_shift_suspects.tsv")
    all_rows_path = os.path.join(args.out_dir, f"{args.lang}_legacy_duplicate_all.tsv")
    summary_path = os.path.join(args.out_dir, "summary.json")

    write_tsv(suspects_path, suspect_rows, fields)
    write_tsv(all_rows_path, all_duplicate_rows, fields)

    issue_counts = {}
    for row in suspect_rows:
        for issue in row["issue"].split(";"):
            issue_counts[issue] = issue_counts.get(issue, 0) + 1

    summary = {
        "source": os.path.normpath(args.source),
        "legacy_translation": os.path.normpath(args.legacy_translation),
        "language": args.lang,
        "source_legacy_key_count": len(source_items),
        "legacy_translation_key_count": len(legacy_translation),
        "duplicate_reference_group_count": len(duplicate_references),
        "duplicate_reference_source_entry_count": sum(
            len(source_groups[reference])
            for reference in duplicate_references
        ),
        "suspect_row_count": len(suspect_rows),
        "all_duplicate_row_count": len(all_duplicate_rows),
        "missing_duplicate_key_count": len(missing_rows),
        "extra_duplicate_key_count": len(extra_rows),
        "issue_counts": issue_counts,
        "files": {
            "suspects_tsv": suspects_path,
            "all_duplicate_rows_tsv": all_rows_path,
        },
    }
    write_json(summary_path, summary)

    print(f"Source legacy keys:          {len(source_items)}")
    print(f"{args.lang} legacy keys:              {len(legacy_translation)}")
    print(f"Duplicate reference groups:  {len(duplicate_references)}")
    print(f"Duplicate source rows:       {summary['duplicate_reference_source_entry_count']}")
    print(f"Suspect rows:                {len(suspect_rows)}")
    print(f"Missing duplicate keys:      {len(missing_rows)}")
    print(f"Extra duplicate keys:        {len(extra_rows)}")
    print(f"Output directory:            {args.out_dir}")


def apply_legacy_corrections_command(args):
    legacy_translation = load_json(args.legacy_translation)
    corrections = []

    with open(args.corrections, "r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file, delimiter="\t")
        if "legacy_key" not in reader.fieldnames or "corrected_path" not in reader.fieldnames:
            raise ValueError("Corrections TSV must include legacy_key and corrected_path columns")
        for row in reader:
            legacy_key = row["legacy_key"].strip()
            corrected_path = row["corrected_path"].strip()
            action = row.get("action", "").strip().lower()
            if not legacy_key:
                continue
            if not corrected_path and action != "blank":
                continue
            corrections.append(row)

    audit_rows = []
    corrected = dict(legacy_translation)
    missing_correction_count = 0
    for row in corrections:
        legacy_key = row["legacy_key"].strip()
        corrected_path = row["corrected_path"].strip()
        action = row.get("action", "").strip().lower()
        if legacy_key not in corrected:
            if not args.allow_missing_corrections:
                raise KeyError(f"Correction references missing legacy key: {legacy_key}")
            missing_correction_count += 1
            audit_rows.append({
                "legacy_key": legacy_key,
                "old_path": "",
                "corrected_path": corrected_path,
                "changed": False,
                "reason": f"missing legacy key; {row.get('reason', '')}",
            })
            continue

        old_path = corrected[legacy_key]
        new_path = "" if action == "blank" else "\n".join(path_from_report(corrected_path))
        corrected[legacy_key] = new_path
        audit_rows.append({
            "legacy_key": legacy_key,
            "old_path": path_for_report(old_path.split("\n")),
            "corrected_path": corrected_path,
            "changed": old_path != new_path,
            "reason": row.get("reason", ""),
        })

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    write_json(args.out, corrected, sort_keys=args.sort_keys)

    if args.audit:
        os.makedirs(os.path.dirname(os.path.abspath(args.audit)), exist_ok=True)
        write_tsv(
            args.audit,
            audit_rows,
            ["legacy_key", "old_path", "corrected_path", "changed", "reason"],
        )

    print(f"Corrections read:            {len(corrections)}")
    print(f"Changed values:              {sum(1 for row in audit_rows if row['changed'])}")
    print(f"Missing correction keys:     {missing_correction_count}")
    print(f"Corrected legacy JSON:       {args.out}")
    if args.audit:
        print(f"Audit TSV:                   {args.audit}")


def legacy_to_stable_command(args):
    source_data = load_json(args.source)
    legacy_translation = load_json(args.legacy_translation)
    source_items = build_legacy_items(source_data, args.hash_length)

    stable_translation = {}
    audit_rows = []
    missing_count = 0
    blank_count = 0
    source_match_count = 0

    for item in source_items:
        legacy_key = item["legacy_key"]
        value = legacy_translation.get(legacy_key)
        source_value = "\n".join(item["source_path"])
        omitted = False
        omit_reason = ""

        if value is None:
            missing_count += 1
            omitted = True
            omit_reason = "missing_legacy_translation"
        elif not isinstance(value, str):
            raise TypeError(f"Legacy translation value for {legacy_key} must be a string")
        elif is_blank_translation_value(value):
            blank_count += 1
            omitted = True
            omit_reason = "blank_translation_value"
        elif args.omit_source_matches and normalized_path_value(value) == item["source_path"]:
            source_match_count += 1
            omitted = True
            omit_reason = "matches_source_path"

        if not omitted:
            stable_translation[item["new_key"]] = value

        audit_rows.append({
            "legacy_key": legacy_key,
            "stable_key": item["new_key"],
            "reference": item["reference"],
            "source_path": path_for_report(item["source_path"]),
            "translation_path": path_for_report(value.split("\n")) if isinstance(value, str) else "",
            "omitted": omitted,
            "omit_reason": omit_reason,
        })

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    write_json(args.out, stable_translation, sort_keys=not args.source_order)

    if args.audit:
        os.makedirs(os.path.dirname(os.path.abspath(args.audit)), exist_ok=True)
        write_tsv(
            args.audit,
            audit_rows,
            [
                "legacy_key",
                "stable_key",
                "reference",
                "source_path",
                "translation_path",
                "omitted",
                "omit_reason",
            ],
        )

    print(f"Source entries:              {len(source_items)}")
    print(f"Stable translation keys:     {len(stable_translation)}")
    print(f"Missing legacy keys:         {missing_count}")
    print(f"Omitted blank values:        {blank_count}")
    if args.omit_source_matches:
        print(f"Omitted source matches:      {source_match_count}")
    else:
        included_source_matches = sum(
            1
            for item in source_items
            if (
                item["legacy_key"] in legacy_translation
                and isinstance(legacy_translation[item["legacy_key"]], str)
                and not is_blank_translation_value(legacy_translation[item["legacy_key"]])
                and normalized_path_value(legacy_translation[item["legacy_key"]]) == item["source_path"]
            )
        )
        print(f"Included source matches:     {included_source_matches}")
    print(f"Stable translation JSON:     {args.out}")
    if args.audit:
        print(f"Audit TSV:                   {args.audit}")



def export_command(args):
    map_data = load_json(args.input)
    flat, manifest = build_export(map_data, args.input, args.hash_length)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    os.makedirs(os.path.dirname(os.path.abspath(args.manifest)), exist_ok=True)
    write_json(args.out, flat, sort_keys=not args.source_order)
    write_json(args.manifest, manifest)

    print(f"Exported {len(flat)} map entries")
    print(f"Transifex JSON: {args.out}")
    print(f"Manifest:       {args.manifest}")


def import_command(args):
    flat_data = load_json(args.input)
    manifest = load_json(args.manifest)
    reconstructed = reconstruct_map(flat_data, manifest, fallback_to_source=args.fallback_to_source)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    write_json(args.out, reconstructed)

    print(f"Rebuilt {args.out}")


def build_parser():
    parser = argparse.ArgumentParser(
        prog="map_tx.py",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description=(
            "Export Quran TFT map files to stable-key Transifex JSON and import them back.\n\n"
            "The key format is:\n"
            "  <exact-surah-verse-reference>__<stable-path-hash>\n\n"
            "The exact reference text is at the beginning of the key so translators can inspect\n"
            "the related verses even if Transifex truncates long keys. Empty references use\n"
            "'empty'. The stable path hash prevents duplicate-reference groups from shifting\n"
            "when one reference typo is fixed. Import does not parse the key; it uses the\n"
            "manifest."
        ),
        epilog=(
            "Examples:\n"
            "  Export English source for Transifex:\n"
            "    python3 scrapper/map-work/map_tx.py export app/src/assets/map.json \\\n"
            "      --out /tmp/map_tx_source.json \\\n"
            "      --manifest /tmp/map_tx_manifest.json\n\n"
            "  Rebuild English map from the exported source JSON:\n"
            "    python3 scrapper/map-work/map_tx.py import /tmp/map_tx_source.json \\\n"
            "      --manifest /tmp/map_tx_manifest.json \\\n"
            "      --out /tmp/map_back.json\n\n"
            "  Rebuild a translated client map from a Transifex download:\n"
            "    python3 scrapper/map-work/map_tx.py import /tmp/map_tx_tr.json \\\n"
            "      --manifest /tmp/map_tx_manifest.json \\\n"
            "      --out app/src/assets/translations/tr/map_tr.json"
        ),
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    export_parser = subparsers.add_parser(
        "export",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        help="Nested map JSON -> stable-key Transifex JSON + manifest",
        description=(
            "Export a nested map into a flat JSON file accepted by Transifex.\n\n"
            "The JSON values are newline-separated path strings. The JSON keys start with the\n"
            "exact reference string and end with the stable path hash."
        ),
    )
    export_parser.add_argument("input", help="Nested source map JSON, usually app/src/assets/map.json")
    export_parser.add_argument("--out", required=True, help="Output flat JSON path for Transifex import")
    export_parser.add_argument("--manifest", required=True, help="Output manifest path for later import")
    export_parser.add_argument(
        "--hash-length",
        type=int,
        default=DEFAULT_HASH_LENGTH,
        help=f"Number of SHA-1 hex chars to keep in each key. Default: {DEFAULT_HASH_LENGTH}",
    )
    export_parser.add_argument(
        "--source-order",
        action="store_true",
        help="Write flat JSON in source traversal order. Default writes sorted keys for stable diffs.",
    )
    export_parser.set_defaults(func=export_command)

    import_parser = subparsers.add_parser(
        "import",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        help="Stable-key Transifex JSON + manifest -> nested client map JSON",
        description=(
            "Import a flat Transifex JSON file into the nested client map format.\n\n"
            "References are read from the manifest, not from the translated path value. This\n"
            "keeps client references identical to the exported source."
        ),
    )
    import_parser.add_argument("input", help="Flat JSON downloaded from Transifex")
    import_parser.add_argument("--manifest", required=True, help="Manifest produced by the export command")
    import_parser.add_argument("--out", required=True, help="Output nested client map JSON")
    import_parser.add_argument(
        "--fallback-to-source",
        action="store_true",
        help="Use source path from manifest when a translation key is missing or invalid.",
    )
    import_parser.set_defaults(func=import_command)

    indexed_report_parser = subparsers.add_parser(
        "indexed-report",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        help="Report duplicate-reference rows that legacy reverse would index",
        description=(
            "Reverse the current source map and translated map using the new stable key rules,\n"
            "then report all duplicate-reference groups that the legacy reverse would have\n"
            "turned into 0__ref, 1__ref, 2__ref keys.\n\n"
            "This is for manual migration review. It does not need the old Transifex source,\n"
            "does not contact Transifex, and does not modify app translation files."
        ),
        epilog=(
            "Example:\n"
            "  python3 scrapper/map-work/map_tx.py indexed-report \\\n"
            "    app/src/assets/map.json \\\n"
            "    app/src/assets/translations/tr/map_tr.json \\\n"
            "    --lang tr \\\n"
            "    --out-dir scrapper/map-work/out/tr-indexed-report"
        ),
    )
    indexed_report_parser.add_argument("source", help="Nested English source map JSON")
    indexed_report_parser.add_argument("translation", help="Nested translated map JSON")
    indexed_report_parser.add_argument("--lang", required=True, help="Language code used in output filenames")
    indexed_report_parser.add_argument("--out-dir", required=True, help="Directory for generated report files")
    indexed_report_parser.add_argument(
        "--hash-length",
        type=int,
        default=DEFAULT_HASH_LENGTH,
        help=f"Number of SHA-1 hex chars to keep in each key. Default: {DEFAULT_HASH_LENGTH}",
    )
    indexed_report_parser.set_defaults(func=indexed_report_command)

    legacy_shift_parser = subparsers.add_parser(
        "legacy-shift-report",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        help="Compare legacy Transifex map JSON against the new stable source keys",
        description=(
            "Compare a raw legacy Transifex translation JSON file with the current source\n"
            "map. The command only inspects duplicate-reference groups, because those are\n"
            "the rows where legacy 0__ref, 1__ref keys can shift when the source map changes.\n\n"
            "The suspects TSV includes the current source path, the new stable key that will\n"
            "replace the legacy key, and the legacy translation path currently attached to\n"
            "that legacy key. If the legacy translation path exactly matches another English\n"
            "source path in the same reference group, the report includes the matched source\n"
            "legacy/new keys so the row can be reviewed or moved manually."
        ),
        epilog=(
            "Example:\n"
            "  python3 scrapper/map-work/map_tx.py legacy-shift-report \\\n"
            "    app/src/assets/map.json \\\n"
            "    scrapper/map-work/out/de-legacy-shift/de_transifex_legacy_raw.json \\\n"
            "    --lang de \\\n"
            "    --out-dir scrapper/map-work/out/de-legacy-shift"
        ),
    )
    legacy_shift_parser.add_argument("source", help="Nested English source map JSON")
    legacy_shift_parser.add_argument(
        "legacy_translation",
        help="Raw legacy key->value map JSON downloaded from Transifex",
    )
    legacy_shift_parser.add_argument("--lang", required=True, help="Language code used in output filenames")
    legacy_shift_parser.add_argument("--out-dir", required=True, help="Directory for generated report files")
    legacy_shift_parser.add_argument(
        "--hash-length",
        type=int,
        default=DEFAULT_HASH_LENGTH,
        help=f"Number of SHA-1 hex chars to keep in each key. Default: {DEFAULT_HASH_LENGTH}",
    )
    legacy_shift_parser.set_defaults(func=legacy_shift_report_command)

    apply_legacy_corrections_parser = subparsers.add_parser(
        "apply-legacy-corrections",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        help="Apply a manual TSV correction list to legacy Transifex map JSON",
        description=(
            "Apply hand-reviewed corrections to a raw legacy Transifex map JSON file.\n\n"
            "The corrections TSV must contain at least these columns:\n"
            "  legacy_key      old key such as 0__2:102\n"
            "  corrected_path  corrected translated path using ' > ' between levels\n\n"
            "Optional column:\n"
            "  action          set to 'blank' to intentionally clear a legacy value\n\n"
            "This command preserves every key from the input JSON and only replaces rows\n"
            "listed in the corrections TSV. It is meant for one-shot legacy-source repair\n"
            "before replacing the Transifex resource."
        ),
        epilog=(
            "Example:\n"
            "  python3 scrapper/map-work/map_tx.py apply-legacy-corrections \\\n"
            "    scrapper/map-work/out/de-legacy-shift/de_transifex_legacy_raw.json \\\n"
            "    --corrections scrapper/map-work/out/de-legacy-shift/de_legacy_manual_corrections.tsv \\\n"
            "    --out scrapper/map-work/out/de-legacy-shift/de_transifex_legacy_corrected.json \\\n"
            "    --audit scrapper/map-work/out/de-legacy-shift/de_legacy_manual_corrections_audit.tsv"
        ),
    )
    apply_legacy_corrections_parser.add_argument(
        "legacy_translation",
        help="Raw legacy key->value map JSON downloaded from Transifex",
    )
    apply_legacy_corrections_parser.add_argument(
        "--corrections",
        required=True,
        help="TSV with legacy_key and corrected_path columns",
    )
    apply_legacy_corrections_parser.add_argument(
        "--out",
        required=True,
        help="Output corrected legacy JSON path",
    )
    apply_legacy_corrections_parser.add_argument("--audit", help="Optional TSV audit path")
    apply_legacy_corrections_parser.add_argument(
        "--sort-keys",
        action="store_true",
        help="Write output JSON sorted by key. Default preserves input order.",
    )
    apply_legacy_corrections_parser.add_argument(
        "--allow-missing-corrections",
        action="store_true",
        help=(
            "Skip correction rows whose legacy key is absent from the input JSON. "
            "Useful with onlytranslated downloads where untranslated keys are omitted."
        ),
    )
    apply_legacy_corrections_parser.set_defaults(func=apply_legacy_corrections_command)

    legacy_to_stable_parser = subparsers.add_parser(
        "legacy-to-stable",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        help="Convert corrected legacy translation JSON to new stable-key JSON",
        description=(
            "Convert a corrected legacy 0__ref translation JSON into the new stable-key\n"
            "<ref>__<hash> JSON that can be uploaded to Transifex after replacing the\n"
            "source resource with the stable-key source.\n\n"
            "The mapping is driven by the current English source map: each source leaf gets\n"
            "its legacy key and its new stable key from the same source traversal. The\n"
            "translation value comes from the corrected legacy translation JSON."
        ),
        epilog=(
            "Example:\n"
            "  python3 scrapper/map-work/map_tx.py legacy-to-stable \\\n"
            "    app/src/assets/map.json \\\n"
            "    scrapper/map-work/out/de-new-system/de_transifex_legacy_corrected.json \\\n"
            "    --out scrapper/map-work/out/de-new-system/de_stable_translation.json \\\n"
            "    --audit scrapper/map-work/out/de-new-system/de_stable_translation_audit.tsv"
        ),
    )
    legacy_to_stable_parser.add_argument("source", help="Nested English source map JSON")
    legacy_to_stable_parser.add_argument(
        "legacy_translation",
        help="Corrected legacy key->value translation JSON",
    )
    legacy_to_stable_parser.add_argument("--out", required=True, help="Output stable-key translation JSON")
    legacy_to_stable_parser.add_argument("--audit", help="Optional TSV audit path")
    legacy_to_stable_parser.add_argument(
        "--omit-source-matches",
        action="store_true",
        help=(
            "Omit values that exactly match the English source path. Default keeps them, "
            "because onlytranslated downloads already represent Transifex's translated set."
        ),
    )
    legacy_to_stable_parser.add_argument(
        "--source-order",
        action="store_true",
        help="Write stable JSON in source traversal order. Default writes sorted keys for stable diffs.",
    )
    legacy_to_stable_parser.add_argument(
        "--hash-length",
        type=int,
        default=DEFAULT_HASH_LENGTH,
        help=f"Number of SHA-1 hex chars to keep in each key. Default: {DEFAULT_HASH_LENGTH}",
    )
    legacy_to_stable_parser.set_defaults(func=legacy_to_stable_command)

    stability_parser = subparsers.add_parser(
        "stability-check",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        help="Unit-test stable keys against legacy duplicate-reference shift risk",
        description=(
            "Test every duplicate-reference group in the source map.\n\n"
            "For each legacy-indexed group, this command changes one referenced leaf at a time\n"
            "and verifies that all other leaves in that same group keep exactly the same new\n"
            "stable key. If any unchanged path's key changes, the command exits with failure."
        ),
        epilog=(
            "Example:\n"
            "  python3 scrapper/map-work/map_tx.py stability-check app/src/assets/map.json \\\n"
            "    --out scrapper/map-work/out/tr-indexed-report/stability_check.json"
        ),
    )
    stability_parser.add_argument("source", help="Nested English source map JSON")
    stability_parser.add_argument("--out", help="Optional JSON report path")
    stability_parser.add_argument(
        "--hash-length",
        type=int,
        default=DEFAULT_HASH_LENGTH,
        help=f"Number of SHA-1 hex chars to keep in each key. Default: {DEFAULT_HASH_LENGTH}",
    )
    stability_parser.set_defaults(func=stability_check_command)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
