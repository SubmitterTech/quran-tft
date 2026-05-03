import argparse
import csv
import importlib.util
import json
import os
import re
import subprocess
import sys
from datetime import datetime


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, "../.."))
DEFAULT_SOURCE = os.path.join(REPO_ROOT, "app/src/assets/map.json")
DEFAULT_MANIFEST = os.path.join(SCRIPT_DIR, "map_tx_manifest.json")
DEFAULT_PULL_SCRIPT = os.path.join(REPO_ROOT, "scrapper/translation-work/pull_translations.py")
DEFAULT_PYTHON = os.path.join(REPO_ROOT, "scrapper/.venv/bin/python")
DEFAULT_LANGUAGES_FILE = os.path.join(REPO_ROOT, "scrapper/translation-work/supported-languages.json")
TX_HASH_RE = re.compile(r"^[0-9a-f]{40}$")


def load_json(path):
    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def write_json(path, data, sort_keys=False):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=4, sort_keys=sort_keys)
        file.write("\n")


def write_tsv(path, rows, fieldnames):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames, delimiter="\t")
        writer.writeheader()
        writer.writerows(rows)


def load_map_tx_module():
    module_path = os.path.join(SCRIPT_DIR, "map_tx.py")
    spec = importlib.util.spec_from_file_location("quran_tft_map_tx", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def default_out_dir():
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return os.path.join(SCRIPT_DIR, "out", f"map-update-{stamp}")


def tx_hash_from_key(tx_key):
    if "__" not in tx_key:
        return None
    candidate = tx_key.rsplit("__", 1)[1]
    if not TX_HASH_RE.match(candidate):
        return None
    return candidate


def flatten_language_config(language_config):
    if not isinstance(language_config, dict):
        raise ValueError("Languages file must be a JSON object")

    flattened = {}
    for code, config in language_config.items():
        if isinstance(config, str):
            flattened[code] = config
        elif isinstance(config, dict):
            flattened[code] = config.get("name", code)
        else:
            raise ValueError(f"Language config for {code!r} must be a string or object")
    return flattened


def write_pull_languages_file(args, reports_dir):
    source_path = args.languages_file or DEFAULT_LANGUAGES_FILE
    language_config = load_json(source_path)
    flattened = flatten_language_config(language_config)
    if args.lang:
        missing = [code for code in args.lang if code not in flattened]
        if missing:
            raise ValueError(
                f"Unknown language code(s) in --lang: {', '.join(missing)}. "
                f"Available: {', '.join(sorted(flattened))}"
            )
        flattened = {code: flattened[code] for code in args.lang}

    temp_path = os.path.join(reports_dir, "pull-map-languages.json")
    write_json(temp_path, flattened, sort_keys=True)
    return temp_path


def run_pull(args, raw_dir, reports_dir):
    pull_languages_file = write_pull_languages_file(args, reports_dir)
    command = [
        args.python,
        "-u",
        args.pull_script,
        "--resource",
        "mapjson",
        "--raw-map-output-dir",
        raw_dir,
        "--raw-map-only",
        "--no-stage",
        "--skip-completeness",
        "--translation-mode",
        "onlytranslated",
        "--verbosity",
        args.verbosity,
        "--languages-file",
        pull_languages_file,
    ]
    if args.lang:
        command.extend(["--lang"] + args.lang)
    if args.api_key_file:
        command.extend(["--api-key-file", args.api_key_file])
    if args.organization:
        command.extend(["--organization", args.organization])
    if args.project:
        command.extend(["--project", args.project])
    if args.poll_interval is not None:
        command.extend(["--poll-interval", str(args.poll_interval)])
    if args.poll_timeout is not None:
        command.extend(["--poll-timeout", str(args.poll_timeout)])
    if args.download_timeout is not None:
        command.extend(["--download-timeout", str(args.download_timeout)])

    print("Pulling latest Transifex map translations...")
    print(" ".join(command))
    subprocess.run(command, check=True, cwd=REPO_ROOT)


def export_source(map_tx, source_path, manifest_path, source_upload_path, hash_length):
    source_data = load_json(source_path)
    abs_source_path = os.path.abspath(source_path)
    try:
        source_label = os.path.relpath(abs_source_path, REPO_ROOT)
    except ValueError:
        source_label = os.path.normpath(source_path)
    source_flat, manifest = map_tx.build_export(source_data, source_label, hash_length)
    write_json(source_upload_path, source_flat, sort_keys=True)
    write_json(manifest_path, manifest)
    return source_flat, manifest


def run_stability_check(args, report_path):
    command = [
        args.python,
        os.path.join(SCRIPT_DIR, "map_tx.py"),
        "stability-check",
        args.source,
        "--out",
        report_path,
        "--hash-length",
        str(args.hash_length),
    ]
    print("Running stable key shift check...")
    subprocess.run(command, check=True, cwd=REPO_ROOT)


def bad_root_for_value(map_tx, value):
    if not isinstance(value, str):
        return True
    levels, _ = map_tx.normalize_map_path(value.split("\n"))
    return bool(levels and len(levels[0]) != 1)


def prepare_targets(map_tx, raw_dir, stable_dir, reports_dir, source_flat, manifest):
    new_key_by_hash = {}
    duplicate_hashes = []
    for item in manifest["items"]:
        tx_hash = tx_hash_from_key(item["key"])
        if tx_hash in new_key_by_hash:
            duplicate_hashes.append(tx_hash)
        new_key_by_hash[tx_hash] = item["key"]
    if duplicate_hashes:
        raise ValueError(f"Duplicate source path hashes in new manifest: {duplicate_hashes[:5]}")

    summary_rows = []
    missing_fields = ["old_key", "old_hash", "raw_path"]
    audit_fields = [
        "old_key",
        "new_key",
        "action",
        "reason",
        "raw_path",
        "normalized_path",
        "new_source_path",
        "normalized",
    ]

    raw_files = sorted(
        filename
        for filename in os.listdir(raw_dir)
        if filename.startswith("map_") and filename.endswith(".json")
    )
    if not raw_files:
        raise FileNotFoundError(f"No raw map JSON files found under {raw_dir}")

    for filename in raw_files:
        lang = filename[len("map_"):-len(".json")]
        raw_path = os.path.join(raw_dir, filename)
        raw_data = load_json(raw_path)
        upload_data = {}
        audit_rows = []
        missing_rows = []
        invalid_key_count = 0
        blank_count = 0
        source_match_count = 0
        normalized_count = 0
        non_string_count = 0
        bad_root_count = 0

        for old_key in sorted(raw_data.keys()):
            value = raw_data[old_key]
            old_hash = tx_hash_from_key(old_key)
            if old_hash is None:
                invalid_key_count += 1
                audit_rows.append({
                    "old_key": old_key,
                    "new_key": "",
                    "action": "omit",
                    "reason": "invalid_stable_key",
                    "raw_path": value.replace("\n", " > ") if isinstance(value, str) else repr(value),
                    "normalized_path": "",
                    "new_source_path": "",
                    "normalized": "",
                })
                continue

            new_key = new_key_by_hash.get(old_hash)
            if new_key is None:
                missing_rows.append({
                    "old_key": old_key,
                    "old_hash": old_hash,
                    "raw_path": value.replace("\n", " > ") if isinstance(value, str) else repr(value),
                })
                audit_rows.append({
                    "old_key": old_key,
                    "new_key": "",
                    "action": "omit",
                    "reason": "path_hash_missing_in_new_source",
                    "raw_path": value.replace("\n", " > ") if isinstance(value, str) else repr(value),
                    "normalized_path": "",
                    "new_source_path": "",
                    "normalized": "",
                })
                continue

            new_source_path = source_flat[new_key]
            if not isinstance(value, str):
                non_string_count += 1
                audit_rows.append({
                    "old_key": old_key,
                    "new_key": new_key,
                    "action": "omit",
                    "reason": "non_string_value",
                    "raw_path": repr(value),
                    "normalized_path": "",
                    "new_source_path": new_source_path.replace("\n", " > "),
                    "normalized": "",
                })
                continue
            if map_tx.is_blank_translation_value(value):
                blank_count += 1
                audit_rows.append({
                    "old_key": old_key,
                    "new_key": new_key,
                    "action": "omit",
                    "reason": "blank_translation_value",
                    "raw_path": value.replace("\n", " > "),
                    "normalized_path": "",
                    "new_source_path": new_source_path.replace("\n", " > "),
                    "normalized": "",
                })
                continue

            normalized_path, normalized = map_tx.normalize_map_path(value.split("\n"))
            normalized_value = "\n".join(normalized_path)
            if normalized:
                normalized_count += 1
            if normalized_value == new_source_path:
                source_match_count += 1
                audit_rows.append({
                    "old_key": old_key,
                    "new_key": new_key,
                    "action": "omit",
                    "reason": "matches_new_source_path",
                    "raw_path": value.replace("\n", " > "),
                    "normalized_path": normalized_value.replace("\n", " > "),
                    "new_source_path": new_source_path.replace("\n", " > "),
                    "normalized": str(bool(normalized)).lower(),
                })
                continue

            if bad_root_for_value(map_tx, normalized_value):
                bad_root_count += 1
            upload_data[new_key] = normalized_value
            audit_rows.append({
                "old_key": old_key,
                "new_key": new_key,
                "action": "write",
                "reason": "",
                "raw_path": value.replace("\n", " > "),
                "normalized_path": normalized_value.replace("\n", " > "),
                "new_source_path": new_source_path.replace("\n", " > "),
                "normalized": str(bool(normalized)).lower(),
            })

        upload_path = os.path.join(stable_dir, f"map_{lang}.json")
        audit_path = os.path.join(reports_dir, f"{lang}_target_rekey_audit.tsv")
        missing_path = os.path.join(reports_dir, f"{lang}_missing_path_hashes.tsv")
        write_json(upload_path, upload_data, sort_keys=True)
        write_tsv(audit_path, audit_rows, audit_fields)
        write_tsv(missing_path, missing_rows, missing_fields)

        summary_rows.append({
            "lang": lang,
            "raw_keys": len(raw_data),
            "upload_keys": len(upload_data),
            "missing_path_hashes": len(missing_rows),
            "invalid_stable_keys": invalid_key_count,
            "blank_values": blank_count,
            "source_matches_omitted": source_match_count,
            "normalized_values": normalized_count,
            "bad_roots_written": bad_root_count,
            "non_string_values": non_string_count,
            "upload_file": upload_path,
        })

    summary_fields = [
        "lang",
        "raw_keys",
        "upload_keys",
        "missing_path_hashes",
        "invalid_stable_keys",
        "blank_values",
        "source_matches_omitted",
        "normalized_values",
        "bad_roots_written",
        "non_string_values",
        "upload_file",
    ]
    summary_path = os.path.join(reports_dir, "target-rekey-summary.tsv")
    write_tsv(summary_path, summary_rows, summary_fields)
    return summary_rows, summary_path


def validate_uploads(map_tx, stable_dir, source_flat, manifest):
    manifest_keys = {item["key"] for item in manifest["items"]}
    rows = []
    for filename in sorted(os.listdir(stable_dir)):
        if not filename.startswith("map_") or not filename.endswith(".json"):
            continue
        path = os.path.join(stable_dir, filename)
        data = load_json(path)
        blank_count = 0
        source_match_count = 0
        bad_root_count = 0
        extra_key_count = 0
        non_string_count = 0

        for key, value in data.items():
            if key not in manifest_keys:
                extra_key_count += 1
            if not isinstance(value, str):
                non_string_count += 1
                continue
            if map_tx.is_blank_translation_value(value):
                blank_count += 1
            normalized_path, _ = map_tx.normalize_map_path(value.split("\n"))
            normalized_value = "\n".join(normalized_path)
            if normalized_value == source_flat.get(key):
                source_match_count += 1
            if normalized_path and len(normalized_path[0]) != 1:
                bad_root_count += 1

        rows.append({
            "file": path,
            "keys": len(data),
            "extra_keys": extra_key_count,
            "blank_values": blank_count,
            "source_matches": source_match_count,
            "bad_roots": bad_root_count,
            "non_string_values": non_string_count,
        })
    return rows


def build_parser():
    parser = argparse.ArgumentParser(
        description=(
            "Prepare mapjson source and target upload files for Transifex after "
            "app/src/assets/map.json changes."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""examples:
  # Normal source-update flow: pull current target maps, export new source,
  # update the committed manifest, and prepare target upload JSON files.
  %(prog)s

  # Prepare only selected languages.
  %(prog)s --lang de tr

  # Use an already downloaded raw snapshot instead of pulling from Transifex.
  %(prog)s --skip-pull --raw-dir scrapper/map-work/out/map-update-20260504-120000/raw-before

Output layout:
  <out-dir>/stable/source_map.json       Upload this as the mapjson source.
  <out-dir>/stable/map_<lang>.json       Upload these to target languages.
  <out-dir>/raw-before/map_<lang>.json   Raw target snapshot before source replace.
  <out-dir>/reports/*.tsv                Audits and missing-hash reports.

Version control:
  Commit app/src/assets/map.json and scrapper/map-work/map_tx_manifest.json.
  Do not commit scrapper/map-work/out/**.
""",
    )
    parser.add_argument("--source", default=DEFAULT_SOURCE, help=f"Source map JSON. Default: {DEFAULT_SOURCE}")
    parser.add_argument(
        "--manifest",
        default=DEFAULT_MANIFEST,
        help=(
            "Manifest path to regenerate for the updated source map. "
            f"Default: {DEFAULT_MANIFEST}"
        ),
    )
    parser.add_argument(
        "--out-dir",
        default=None,
        help="Output directory. Default: scrapper/map-work/out/map-update-<timestamp>",
    )
    parser.add_argument("--lang", nargs="+", metavar="CODE", help="Language code(s) to prepare. Default: all supported languages.")
    parser.add_argument("--skip-pull", action="store_true", help="Use --raw-dir instead of pulling latest mapjson from Transifex.")
    parser.add_argument("--raw-dir", help="Existing raw map payload directory, required with --skip-pull.")
    parser.add_argument(
        "--languages-file",
        help=(
            "Language config to read. Resource include/exclude filters are ignored here "
            "because this script specifically prepares mapjson uploads."
        ),
    )
    parser.add_argument("--api-key-file", help="Transifex API key file path passed to pull_translations.py.")
    parser.add_argument("--organization", help="Transifex organization slug passed to pull_translations.py.")
    parser.add_argument("--project", help="Transifex project slug passed to pull_translations.py.")
    parser.add_argument("--poll-interval", type=float, help="Pull polling interval in seconds.")
    parser.add_argument("--poll-timeout", type=float, help="Pull polling timeout in seconds.")
    parser.add_argument("--download-timeout", type=float, help="Pull download timeout in seconds.")
    parser.add_argument("--verbosity", choices=["quiet", "normal", "debug"], default="normal", help="Pull logging detail. Default: normal.")
    parser.add_argument("--hash-length", type=int, default=40, help="Stable path hash length. Default: 40.")
    parser.add_argument("--python", default=DEFAULT_PYTHON, help=f"Python executable. Default: {DEFAULT_PYTHON}")
    parser.add_argument("--pull-script", default=DEFAULT_PULL_SCRIPT, help=f"pull_translations.py path. Default: {DEFAULT_PULL_SCRIPT}")
    return parser


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(line_buffering=True)

    parser = build_parser()
    args = parser.parse_args()
    if args.skip_pull and not args.raw_dir:
        parser.error("--skip-pull requires --raw-dir")

    out_dir = args.out_dir or default_out_dir()
    raw_dir = args.raw_dir or os.path.join(out_dir, "raw-before")
    stable_dir = os.path.join(out_dir, "stable")
    reports_dir = os.path.join(out_dir, "reports")
    os.makedirs(raw_dir, exist_ok=True)
    os.makedirs(stable_dir, exist_ok=True)
    os.makedirs(reports_dir, exist_ok=True)

    if not args.skip_pull:
        run_pull(args, raw_dir, reports_dir)
    else:
        print(f"Using existing raw map snapshot: {raw_dir}")

    map_tx = load_map_tx_module()
    source_upload_path = os.path.join(stable_dir, "source_map.json")
    source_flat, manifest = export_source(
        map_tx=map_tx,
        source_path=args.source,
        manifest_path=args.manifest,
        source_upload_path=source_upload_path,
        hash_length=args.hash_length,
    )
    print(f"Exported source upload: {source_upload_path}")
    print(f"Updated manifest:       {args.manifest}")

    stability_report = os.path.join(reports_dir, "source-stability-check.json")
    run_stability_check(args, stability_report)

    summary_rows, summary_path = prepare_targets(
        map_tx=map_tx,
        raw_dir=raw_dir,
        stable_dir=stable_dir,
        reports_dir=reports_dir,
        source_flat=source_flat,
        manifest=manifest,
    )
    validation_rows = validate_uploads(map_tx, stable_dir, source_flat, manifest)
    validation_path = os.path.join(reports_dir, "upload-validation.tsv")
    write_tsv(
        validation_path,
        validation_rows,
        ["file", "keys", "extra_keys", "blank_values", "source_matches", "bad_roots", "non_string_values"],
    )

    failures = [
        row
        for row in validation_rows
        if (
            row["extra_keys"]
            or row["blank_values"]
            or row["source_matches"]
            or row["bad_roots"]
            or row["non_string_values"]
        )
    ]
    missing_total = sum(row["missing_path_hashes"] for row in summary_rows)
    invalid_total = sum(row["invalid_stable_keys"] for row in summary_rows)

    print("\nPrepared Transifex upload files:")
    print(f"Source: {source_upload_path}")
    for row in summary_rows:
        print(
            f"{row['lang']}: {row['upload_keys']} upload keys "
            f"(missing hashes: {row['missing_path_hashes']}, "
            f"source matches omitted: {row['source_matches_omitted']})"
        )
    print(f"\nSummary:    {summary_path}")
    print(f"Validation: {validation_path}")
    print(f"Reports:    {reports_dir}")

    if failures or missing_total or invalid_total:
        print("\nReview required before upload.")
        if missing_total:
            print(f"Missing path hashes: {missing_total}")
        if invalid_total:
            print(f"Invalid stable keys: {invalid_total}")
        if failures:
            print(f"Upload validation failures: {len(failures)}")
        return 2

    print("\nUpload order:")
    print(f"1. Replace Transifex mapjson source with {source_upload_path}")
    print(f"2. Upload target files from {stable_dir}/map_<lang>.json")
    print("3. After upload, run pull_translations.py --assume-yes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
