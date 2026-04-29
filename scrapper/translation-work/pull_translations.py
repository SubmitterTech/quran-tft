import os
import argparse
import sys
import time

# --- CLI argument parsing (before heavy imports so --help always works) ---
ALL_RESOURCE_SLUGS = [
    'coverjson',
    'introductionjson',
    'quranjson',
    'applicationjson',
    'appendicesjson',
    'mapjson'
]

parser = argparse.ArgumentParser(
    description='Pull translations from Transifex and optionally commit changes.',
    formatter_class=argparse.RawDescriptionHelpFormatter,
    epilog="""examples:
  %(prog)s                                  # pull all languages, all resources (original behavior)
  %(prog)s --lang tr                        # pull only Turkish
  %(prog)s --lang tr de                     # pull Turkish and German
  %(prog)s --resource quranjson             # pull only quranjson for all languages
  %(prog)s --lang tr --resource quranjson   # pull only quranjson for Turkish
  %(prog)s --no-commit                      # pull all but skip commit prompt
  %(prog)s --no-stage                       # pull all but don't stage or commit (just write files)
  %(prog)s --dry-run                        # show what would be done without writing files
  %(prog)s --assume-yes                     # auto-commit without interactive confirmation
  %(prog)s --skip-completeness              # skip updating completeness percentages in languages.json
  %(prog)s --translation-mode onlytranslated # omit untranslated strings from downloaded files
  %(prog)s --raw-map-output-dir /tmp/raw-maps # also save raw Transifex mapjson payloads
  %(prog)s --raw-map-only --resource mapjson # save raw mapjson payloads without reconstructing local maps
  %(prog)s --map-manifest /path/to/manifest.json # stable-key map manifest
  %(prog)s --api-key-file /path/to/key      # use a custom API key file
  %(prog)s --output-dir /path/to/dir        # save translations to a custom directory
  %(prog)s --languages-file /path/to/file   # use a custom supported-languages.json file
""")
parser.add_argument('--lang', nargs='+', metavar='CODE',
                    help='Language code(s) to pull (e.g. tr de ru). Default: all supported languages.')
parser.add_argument('--resource', nargs='+', metavar='SLUG', choices=ALL_RESOURCE_SLUGS,
                    help=f'Resource slug(s) to pull. Choices: {", ".join(ALL_RESOURCE_SLUGS)}. Default: all.')
parser.add_argument('--no-commit', action='store_true',
                    help='Pull and stage changes but skip the commit prompt.')
parser.add_argument('--no-stage', action='store_true',
                    help='Pull and write files but do not stage or commit (review only).')
parser.add_argument('--dry-run', action='store_true',
                    help='Show what would be done without writing any files.')
parser.add_argument('--assume-yes', '--asume-yes', action='store_true',
                    help='Automatically commit staged changes without asking for confirmation.')
parser.add_argument('--skip-completeness', action='store_true',
                    help='Skip updating completeness percentages in languages.json.')
parser.add_argument('--api-key-file', metavar='PATH',
                    help='Path to the Transifex API key file. Default: transifex-api-key in script dir.')
parser.add_argument('--output-dir', metavar='PATH',
                    help='Base directory for saving translations. Default: ../../app/src/assets/translations')
parser.add_argument('--languages-file', metavar='PATH',
                    help='Path to supported-languages.json. Default: supported-languages.json in script dir.')
parser.add_argument('--organization', default='submittertech', metavar='SLUG',
                    help='Transifex organization slug. Default: submittertech')
parser.add_argument('--project', default='quranthefinaltestament', metavar='SLUG',
                    help='Transifex project slug. Default: quranthefinaltestament')
parser.add_argument('--poll-interval', type=float, default=2.0, metavar='SECONDS',
                    help='Seconds between async download status checks. Default: 2')
parser.add_argument('--poll-timeout', type=float, default=300.0, metavar='SECONDS',
                    help='Maximum seconds to wait for a Transifex async download. Default: 300')
parser.add_argument('--download-timeout', type=float, default=120.0, metavar='SECONDS',
                    help='Read timeout in seconds for the final file download. Default: 120')
parser.add_argument('--translation-mode', default='default', metavar='MODE',
                    help=(
                        'Transifex translation download mode. Use "onlytranslated" to include '
                        'translated/reviewed/proofread strings and omit untranslated strings. '
                        'Default: default'
                    ))
parser.add_argument('--raw-map-output-dir', metavar='PATH',
                    help=(
                        'Optional directory for raw mapjson key-value payloads downloaded '
                        'from Transifex before legacy reconstruction.'
                    ))
parser.add_argument('--raw-map-only', action='store_true',
                    help=(
                        'For mapjson resources, save the raw Transifex payload and skip '
                        'legacy reconstruction/output. Requires --raw-map-output-dir.'
                    ))
parser.add_argument('--map-manifest', metavar='PATH',
                    help=(
                        'Stable-key map manifest path. Default: ../map-work/map_tx_manifest.json. '
                        'Used automatically when downloaded mapjson keys match the stable format.'
                    ))
parser.add_argument('--verbosity', choices=['quiet', 'normal', 'debug'], default='normal',
                    help='Logging detail for async download steps. Default: normal')

args = parser.parse_args()
if args.raw_map_only and not args.raw_map_output_dir:
    parser.error('--raw-map-only requires --raw-map-output-dir')

# --- Heavy imports (after argparse so --help works without dependencies) ---
import ctypes

# Path to your Homebrew ICU 76 libraries (adjust if using Apple Silicon)
icu_lib_path = "/usr/local/opt/icu4c@76/lib"

# Explicitly load the necessary ICU libraries into the global namespace.
# This forces the dynamic linker to use these libraries instead of the system ICU.
for lib_name in ["libicuuc.76.dylib", "libicui18n.76.dylib", "libicudata.76.dylib"]:
    lib_path = os.path.join(icu_lib_path, lib_name)
    print(f"Loading ICU library: {lib_path}")
    ctypes.CDLL(lib_path, mode=ctypes.RTLD_GLOBAL)

from transifex.api import transifex_api
import requests
import json
import re
import subprocess
import importlib.util
from icu import Collator, Locale

# Determine the directory where this script is located.
script_dir = os.path.dirname(os.path.abspath(__file__))
map_work_dir = os.path.normpath(os.path.join(script_dir, "../map-work"))
default_map_manifest_path = os.path.join(map_work_dir, "map_tx_manifest.json")
map_manifest_path = args.map_manifest or default_map_manifest_path

# Read the API token from the file
api_token_path = args.api_key_file or os.path.join(script_dir, 'transifex-api-key')
with open(api_token_path, 'r') as token_file:
    api_token = token_file.read().strip()
assert api_token, "ERROR: API token is missing or empty. Please check the 'transifex-api-key' file."

# Initialize the Transifex API with the credentials
transifex_api.setup(auth=api_token)

# Define the project and resource details
organization_slug = args.organization
project_slug = args.project
resource_slugs = args.resource if args.resource else ALL_RESOURCE_SLUGS

def parse_resource_override_list(raw_list, field_name, language_code):
    if raw_list is None:
        return None
    if not isinstance(raw_list, list) or any(not isinstance(item, str) for item in raw_list):
        raise ValueError(
            f"ERROR: '{field_name}' for language '{language_code}' must be a list of resource slugs."
        )
    normalized = [item.strip() for item in raw_list if item.strip()]
    invalid = [item for item in normalized if item not in ALL_RESOURCE_SLUGS]
    if invalid:
        raise ValueError(
            f"ERROR: '{field_name}' for language '{language_code}' has unknown resource slug(s): "
            f"{', '.join(sorted(set(invalid)))}"
        )
    return normalized

def load_supported_languages(filename=None):
    # Use the provided filename or default to 'supported-languages.json' in script_dir.
    if filename is None:
        filename = os.path.join(script_dir, "supported-languages.json")
    if not os.path.exists(filename):
        raise FileNotFoundError(
            f"ERROR: {filename} not found. Please provide the supported-languages.json configuration file."
        )
    with open(filename, "r", encoding="utf-8") as f:
        supported_languages = json.load(f)
    if not isinstance(supported_languages, dict):
        raise ValueError(
            "ERROR: The configuration file must be a JSON object mapping language codes "
            "to either language names (string) or language config objects."
        )

    language_names = {}
    language_settings = {}

    for language_code, config in supported_languages.items():
        if not isinstance(language_code, str) or not language_code.strip():
            raise ValueError("ERROR: Language codes must be non-empty strings.")

        code = language_code.strip()
        include_resources = None
        exclude_resources = None

        if isinstance(config, str):
            language_name = config
        elif isinstance(config, dict):
            language_name = config.get("name", code)
            include_resources = parse_resource_override_list(
                config.get("include_resources"), "include_resources", code
            )
            exclude_resources = parse_resource_override_list(
                config.get("exclude_resources"), "exclude_resources", code
            )
        else:
            raise ValueError(
                f"ERROR: Language '{code}' must be a string name or an object config."
            )

        if not isinstance(language_name, str) or not language_name.strip():
            raise ValueError(f"ERROR: Language '{code}' must define a non-empty name.")

        language_names[code] = language_name.strip()
        language_settings[code] = {
            "include_resources": include_resources,
            "exclude_resources": exclude_resources
        }

    return list(language_names.keys()), language_names, language_settings

language_codes, language_names, language_settings = load_supported_languages(args.languages_file)

# Filter language codes if --lang is specified
if args.lang:
    invalid_langs = [l for l in args.lang if l not in language_names]
    if invalid_langs:
        print(f"ERROR: Unknown language code(s): {', '.join(invalid_langs)}")
        print(f"Available: {', '.join(sorted(language_names.keys()))}")
        sys.exit(1)
    language_codes = args.lang

# Fetch organization and project
organization = transifex_api.Organization.get(slug=organization_slug)
project = organization.fetch('projects').get(slug=project_slug)

# Base path for saving translations
base_path = args.output_dir or os.path.normpath(os.path.join(script_dir, "../../app/src/assets/translations"))

# Print run configuration
print(f"\n--- Configuration ---")
print(f"Languages: {', '.join(language_codes)}")
print(f"Resources: {', '.join(resource_slugs)}")
print(f"Output:    {base_path}")
print(f"Download:  {args.translation_mode}")
if args.raw_map_output_dir:
    print(f"Raw maps:  {args.raw_map_output_dir}")
if args.raw_map_only:
    print(f"Raw only:  yes")
if 'mapjson' in resource_slugs:
    print(f"Map manifest: {map_manifest_path}")
if args.dry_run:
    print(f"Mode:      DRY RUN (no files will be written)")
elif args.no_stage:
    print(f"Mode:      NO STAGE (files written but not staged/committed)")
elif args.no_commit:
    print(f"Mode:      NO COMMIT (files written and staged but not committed)")
print(f"---------------------\n")


def get_sort_key_func(language_code):
    """
    Returns a sort key function using PyICU's Collator for the specified language code.
    """
    collator = Collator.createInstance(Locale(language_code))
    def icu_sort_key(s):
        # Get the sort key for the given string
        return collator.getSortKey(str(s))
    return icu_sort_key

def sort_dictionary(data, language_code):
    """
    Recursively sort a dictionary by keys using the ICU-based sort key function for the specified language.
    """
    if isinstance(data, dict):
        sort_key_func = get_sort_key_func(language_code)
        sorted_items = sorted(data.items(), key=lambda item: sort_key_func(item[0]))
        return {k: sort_dictionary(v, language_code) for k, v in sorted_items}
    return data

def extract_chapter_verse_pairs(s):
    """Extract all (chapter, verse) pairs as integers from a scripture reference."""
    s = s.strip()
    refs = re.split(r'[;,]', s)
    chapter_verse_pairs = []
    for ref in refs:
        ref = ref.strip()
        # Handle ranges like '4:11-12' or '9:23-24'
        match = re.match(r'(\d+):(\d+)(?:-(\d+))?', ref)
        if match:
            chapter = int(match.group(1))
            verse_start = int(match.group(2))
            verse_end = int(match.group(3)) if match.group(3) else verse_start
            chapter_verse_pairs.append((chapter, verse_start))
        else:
            # Handle single chapters or verses without ranges
            match = re.match(r'(\d+)(?::(\d+))?', ref)
            if match:
                chapter = int(match.group(1))
                verse = int(match.group(2)) if match.group(2) else 0
                chapter_verse_pairs.append((chapter, verse))
    return chapter_verse_pairs

def custom_sort_key(s):
    """Generate a sorting key based on the earliest (chapter, verse) in the reference."""
    chapter_verse_pairs = extract_chapter_verse_pairs(s)
    if chapter_verse_pairs:
        return min(chapter_verse_pairs)
    else:
        return (float('inf'), float('inf'))

def concatenate_and_sort(values):
    """Concatenate and sort scripture references by their chapter and verse numbers."""
    sorted_values = sorted(values, key=custom_sort_key)
    concatenated_result = "; ".join(sorted_values)
    return concatenated_result

INVISIBLE_BLANK_CHARS = "\u200b\u200c\u200d\ufeff"

def strip_invisible_blank_chars(value):
    for char in INVISIBLE_BLANK_CHARS:
        value = value.replace(char, "")
    return value

def normalize_map_levels(levels):
    cleaned = [strip_invisible_blank_chars(part).strip() for part in levels]
    cleaned = [part for part in cleaned if part]
    if not cleaned:
        return []

    root = cleaned[0]
    if len(root) == 1:
        return cleaned

    normalized_root = root[0]
    if len(cleaned) == 1:
        return [normalized_root, root]
    return [normalized_root] + cleaned[1:]

def reconstruct_dictionary(transformed_data, language_code):
    reconstructed_dict = {}

    for key, path in transformed_data.items():
        levels = normalize_map_levels(path.split('\n'))
        if not levels:
            continue
        current_level = reconstructed_dict

        for i, part in enumerate(levels):
            # Determine if at the last level
            is_last_level = (i == len(levels) - 1)
            if is_last_level:
                original_key = key.split('__', 1)[-1]
                if part in current_level and not isinstance(current_level[part], dict):
                    # Handling potential overwriting or concatenation
                    current_value = current_level[part]
                    # Split original_key and current_value to handle them as sets of discrete items
                    original_values = set(original_key.split(';'))
                    current_values = set(current_value.split(';'))

                    if current_values.issubset(original_values):
                        print(f"OVERRIDE: {part} \nOVERRIDE: existing: '{current_value}' with incoming: '{original_key}'")
                        current_level[part] = original_key
                    else:
                        new_values = original_values.union(current_values)
                        concatenated_result = concatenate_and_sort(new_values)
                        print(f"CONCATENATE: {part} \nCONCATENATE: existing: '{current_value}'\nCONCATENATE: with incoming: '{original_key}' \nCONCATENATE: result is '{concatenated_result}'")
                        current_level[part] = concatenated_result
                else:
                    # Setting values in the dictionary, handling non-dict types explicitly
                    if "empty" in key:
                        current_level[part] = ""
                    else:
                        if part not in current_level:
                            current_level[part] = original_key
                        else:
                            if "" not in current_level[part]:
                                print(f"CREATE EMPTY KEY: {part}")
                                current_level[part][""] = original_key
            else:
                if part not in current_level:
                    current_level[part] = {}
                elif not isinstance(current_level[part], dict):
                    print(f"ERROR: Expected a dict at {part}, found {type(current_level[part])}. Adjusting structure.")
                    current_value = current_level[part]
                    # Preserve current value under an empty key
                    current_level[part] = {"": current_value}
                current_level = current_level[part]

    return sort_dictionary(reconstructed_dict, language_code)


_map_tx_module = None
_map_tx_manifest_cache = None


def load_map_tx_module():
    global _map_tx_module
    if _map_tx_module is not None:
        return _map_tx_module

    module_path = os.path.join(map_work_dir, "map_tx.py")
    if not os.path.exists(module_path):
        raise FileNotFoundError(
            f"Stable map helper not found: {module_path}. "
            "Run from the repository checkout or provide legacy mapjson input."
        )

    spec = importlib.util.spec_from_file_location("quran_tft_map_tx", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _map_tx_module = module
    return module


def load_map_tx_manifest():
    global _map_tx_manifest_cache
    if _map_tx_manifest_cache is not None:
        return _map_tx_manifest_cache

    if not os.path.exists(map_manifest_path):
        raise FileNotFoundError(
            f"Stable map manifest not found: {map_manifest_path}. "
            "Regenerate it with scrapper/map-work/map_tx.py export."
        )

    with open(map_manifest_path, "r", encoding="utf-8") as manifest_file:
        manifest = json.load(manifest_file)
    if manifest.get("kind") != "quran-tft-map-tx-manifest":
        raise ValueError(f"Unexpected stable map manifest kind in {map_manifest_path}")

    _map_tx_manifest_cache = manifest
    return manifest


def get_manifest_key_set(manifest):
    return {item["key"] for item in manifest.get("items", [])}


def is_stable_map_payload(transformed_data, manifest):
    if not isinstance(transformed_data, dict) or not transformed_data:
        return False
    keys = set(transformed_data.keys())
    manifest_keys = get_manifest_key_set(manifest)
    return bool(keys) and keys.issubset(manifest_keys)


def reconstruct_stable_map(transformed_data, language_code, language_label):
    map_tx = load_map_tx_module()
    manifest = load_map_tx_manifest()
    manifest_keys = get_manifest_key_set(manifest)

    extra_keys = set(transformed_data.keys()) - manifest_keys
    if extra_keys:
        sample = ", ".join(sorted(extra_keys)[:5])
        raise ValueError(
            f"Stable map payload for '{language_label}' contains keys missing from the manifest: {sample}"
        )

    # Transifex can return blank strings for untranslated stable keys. Treat those
    # as absent so the client map falls back to the English source path.
    cleaned_flat = {
        key: value
        for key, value in transformed_data.items()
        if isinstance(value, str) and not map_tx.is_blank_translation_value(value)
    }
    reconstructed = map_tx.reconstruct_map(cleaned_flat, manifest, fallback_to_source=True)
    print(
        f"[{language_label}/mapjson] Detected stable-key map payload "
        f"({len(cleaned_flat)} translated values, {len(manifest.get('items', [])) - len(cleaned_flat)} source fallbacks)"
    )
    return sort_dictionary(reconstructed, language_code)


VERBOSITY_LEVELS = {
    'quiet': 0,
    'normal': 1,
    'debug': 2,
}


def should_log(level):
    return VERBOSITY_LEVELS[args.verbosity] >= VERBOSITY_LEVELS[level]


def log_download_event(language_code, resource_slug, message, level='normal'):
    if should_log(level):
        print(f"[{language_code}/{resource_slug}] {message}")


def extract_async_errors(download_job):
    attributes = getattr(download_job, 'attributes', {}) or {}
    errors = attributes.get('errors') or []
    if isinstance(errors, list):
        return errors
    return []


def wait_for_translation_download_url(resource, language, language_code, resource_slug):
    started_at = time.monotonic()
    download_kwargs = {
        'resource': resource,
        'language': language,
    }
    if args.translation_mode != 'default':
        download_kwargs['mode'] = args.translation_mode

    download_job = transifex_api.ResourceTranslationsAsyncDownload.create(**download_kwargs)

    last_status = (getattr(download_job, 'attributes', {}) or {}).get('status')
    job_label = download_job.id or 'unknown'
    log_download_event(
        language_code,
        resource_slug,
        f"Async download job created (job={job_label}, status={last_status or 'unknown'})",
        level='debug'
    )

    while True:
        errors = extract_async_errors(download_job)
        if errors:
            detail = errors[0].get('detail', 'Unknown async download error')
            raise RuntimeError(
                f"Transifex async download failed for '{language_code}/{resource_slug}': {detail}"
            )

        if download_job.redirect:
            elapsed = time.monotonic() - started_at
            log_download_event(
                language_code,
                resource_slug,
                f"Export ready after {elapsed:.1f}s"
            )
            return download_job.redirect

        current_status = (getattr(download_job, 'attributes', {}) or {}).get('status')
        if current_status == 'failed':
            raise RuntimeError(
                f"Transifex async download failed for '{language_code}/{resource_slug}' "
                f"without error details."
            )

        elapsed = time.monotonic() - started_at
        if elapsed > args.poll_timeout:
            raise TimeoutError(
                f"Timed out after {elapsed:.1f}s waiting for '{language_code}/{resource_slug}' "
                f"(job={job_label}, status={current_status or 'unknown'})."
            )

        if current_status != last_status and current_status:
            log_download_event(
                language_code,
                resource_slug,
                f"Async status changed to '{current_status}' after {elapsed:.1f}s",
                level='debug'
            )
            last_status = current_status

        time.sleep(args.poll_interval)
        download_job.reload()


def download_translation_payload(resource, language, language_code, resource_slug):
    overall_started_at = time.monotonic()
    log_download_event(language_code, resource_slug, "Requesting translation export")
    download_url = wait_for_translation_download_url(
        resource=resource,
        language=language,
        language_code=language_code,
        resource_slug=resource_slug
    )

    log_download_event(language_code, resource_slug, "Downloading exported file", level='debug')
    try:
        response = requests.get(download_url, timeout=(10, args.download_timeout))
        response.raise_for_status()
    except requests.RequestException as exc:
        raise RuntimeError(
            f"Failed to download exported file for '{language_code}/{resource_slug}': {exc}"
        ) from exc

    response.encoding = 'utf-8'
    content_length = response.headers.get('Content-Length', 'unknown')
    log_download_event(
        language_code,
        resource_slug,
        (
            f"File downloaded successfully "
            f"(HTTP {response.status_code}, elapsed={time.monotonic() - overall_started_at:.1f}s)"
        )
    )
    log_download_event(
        language_code,
        resource_slug,
        f"Downloaded bytes={content_length}",
        level='debug'
    )
    return response.text

updated_languages = set()  # Keep track of languages with changes

for language_code in language_codes:
    setting = language_settings.get(language_code, {})
    include_resources = setting.get("include_resources") or []
    exclude_resources = setting.get("exclude_resources") or []

    selected_resources = list(resource_slugs)
    if include_resources:
        include_set = set(include_resources)
        selected_resources = [slug for slug in selected_resources if slug in include_set]
    if exclude_resources:
        exclude_set = set(exclude_resources)
        selected_resources = [slug for slug in selected_resources if slug not in exclude_set]

    if not selected_resources:
        print(
            f"Skipping language '{language_code}': no resources left after "
            f"supported-languages.json filters."
        )
        continue

    # Fetch the language object
    language = transifex_api.Language.get(code=language_code)

    # Initialize a flag to check if any files were saved for this language
    files_saved = False

    for resource_slug in selected_resources:
        # Fetch the resource
        resource = project.fetch('resources').get(slug=resource_slug)

        # Start the async export, poll until it is ready, and then download the file.
        response_text = download_translation_payload(
            resource=resource,
            language=language,
            language_code=language_code,
            resource_slug=resource_slug
        )

        # Define the output file path (relative to script_dir)
        lang_dir = os.path.join(base_path, language_code)
        resource_name = resource_slug.replace('json', '')
        output_filename = f"{resource_name}_{language_code}.json"
        output_path = os.path.join(lang_dir, output_filename)

        try:
            translated_content = json.loads(response_text)
        except json.JSONDecodeError as e:
            print(f"ERROR: while parsing JSON for language '{language_code}' and resource '{resource_slug}': {e}")

            # Check if this is the known issue with Russian 'appendicesjson'
            if language_code == 'ru' and resource_slug == 'appendicesjson':
                print("Attempting to fix known control character issue in Russian 'appendicesjson'...")
                # Replace the specific control character (\x02) with a hyphen or appropriate character
                cleaned_text = response_text.replace('\x02', '-')
                try:
                    translated_content = json.loads(cleaned_text)
                    print("Successfully parsed JSON after cleaning.")
                except json.JSONDecodeError as e_inner:
                    print(f"Failed to parse cleaned JSON for '{language_code}' and '{resource_slug}': {e_inner}")
                    continue
            else:
                raise

        # Only proceed if there is content to save
        if translated_content:
            if resource_slug == 'mapjson' and args.raw_map_output_dir and not args.dry_run:
                os.makedirs(args.raw_map_output_dir, exist_ok=True)
                raw_output_path = os.path.join(args.raw_map_output_dir, f"map_{language_code}.json")
                with open(raw_output_path, 'w', encoding='utf-8') as raw_file:
                    json.dump(translated_content, raw_file, ensure_ascii=False, indent=4)
                print(f"Saved raw map payload {raw_output_path}")

            if resource_slug == 'mapjson' and args.raw_map_only:
                files_saved = True
                continue

            if args.dry_run:
                print(f"[DRY RUN] Would save {output_path}")
                files_saved = True
            else:
                # Ensure the language directory exists
                os.makedirs(lang_dir, exist_ok=True)
                files_saved = True

                if resource_slug == 'mapjson':
                    transformed_data = translated_content
                    manifest = load_map_tx_manifest()
                    if is_stable_map_payload(transformed_data, manifest):
                        reconstructed_dict = reconstruct_stable_map(
                            transformed_data,
                            language_code,
                            language_code,
                        )
                    else:
                        reconstructed_dict = reconstruct_dictionary(transformed_data, language_code)
                    with open(output_path, 'w', encoding='utf-8') as new_file:
                        json.dump(reconstructed_dict, new_file, ensure_ascii=False, indent=4)
                else:
                    with open(output_path, 'w', encoding='utf-8') as new_file:
                        json.dump(translated_content, new_file, ensure_ascii=False, indent=4)
                print(f"Saved {output_path}")

    if files_saved:
        if args.dry_run:
            updated_languages.add(language_code)
        else:
            # After saving files for a language, check if there are changes
            lang_dir = os.path.join(base_path, language_code)
            lang_status = subprocess.run(
                ['git', 'status', '--porcelain', lang_dir], capture_output=True, text=True)
            if lang_status.stdout.strip():
                # There are changes in this language directory
                updated_languages.add(language_code)
                if not args.no_stage:
                    # Stage the changed files
                    subprocess.run(['git', 'add', lang_dir])

# --- Update languages.json with completeness percentages ---
languages_json_changed = False

if not args.skip_completeness and not args.dry_run:
    # Path to the languages.json file (relative to script_dir)
    languages_json_path = os.path.normpath(os.path.join(script_dir, "../../app/src/assets/languages.json"))

    # Load the existing languages.json file
    with open(languages_json_path, 'r', encoding='utf-8') as f:
        languages_data = json.load(f)

    # Fetch project language stats
    project_stats = transifex_api.ResourceLanguageStats.filter(project=project)

    # Calculate completeness percentage per language
    completeness_percentages = {}

    for stat in project_stats:
        # Parse language and resource details from the string output
        language_str = str(stat.language)

        # Extract language code from the unfetched string representation
        language_code = language_str.split(': ')[1].split(' ')[0].replace('l:', '')

        # Skip the source language (en)
        if language_code == 'en':
            continue

        translated_strings = stat.attributes['translated_strings']
        total_strings = stat.attributes['total_strings']

        # Calculate completeness percentage
        if language_code not in completeness_percentages:
            completeness_percentages[language_code] = {'translated_strings': 0, 'total_strings': 0}

        completeness_percentages[language_code]['translated_strings'] += translated_strings
        completeness_percentages[language_code]['total_strings'] += total_strings

    # Update the 'comp' values in languages_data
    for language_code, stats in completeness_percentages.items():
        total_strings = stats['total_strings']
        translated_strings = stats['translated_strings']
        completeness_percentage = (translated_strings / total_strings) * 100 if total_strings else 0

        # Round the completeness percentage to two decimal places
        completeness_percentage = round(completeness_percentage, 2)

        # If the percentage is a whole number, convert it to int
        if completeness_percentage.is_integer():
            completeness_percentage = int(completeness_percentage)
        if language_code in languages_data:
            old_comp = languages_data[language_code].get('comp', None)
            languages_data[language_code]['comp'] = completeness_percentage
            if old_comp != completeness_percentage:
                languages_json_changed = True
                print(f"Updated {language_code} completeness to {completeness_percentage}%")
        else:
            print(f"ERROR: Language {language_code} not found in languages.json")

    # Save the updated languages.json file if changes were made
    if languages_json_changed:
        with open(languages_json_path, 'w', encoding='utf-8') as f:
            json.dump(languages_data, f, indent=4, ensure_ascii=False)
        if not args.no_stage:
            # Stage languages.json for commit
            subprocess.run(['git', 'add', languages_json_path])
            print(f"Staged {languages_json_path} for commit")
        else:
            print(f"Updated {languages_json_path} (not staged)")
elif args.skip_completeness:
    print("\nSkipped completeness percentage update (--skip-completeness).")
elif args.dry_run:
    print("\n[DRY RUN] Would update completeness percentages in languages.json.")

# --- Summary and commit ---
if updated_languages or languages_json_changed:
    updated_language_codes = sorted(updated_languages)
    languages_str = ', '.join(updated_language_codes)

    if updated_language_codes and languages_json_changed:
        commit_message = f"Update translations ({languages_str}) and completeness from Transifex"
    elif updated_language_codes:
        commit_message = f"Update translations ({languages_str}) from Transifex"
    else:
        commit_message = "Update translation completeness from Transifex"

    print("\nThe following languages have been updated:")
    if updated_language_codes:
        print(languages_str)
    if languages_json_changed:
        print("languages.json has been updated with new completeness percentages.")
    print(f"\nCommit message: '{commit_message}'")

    if args.dry_run:
        print("\n[DRY RUN] No files were written or committed.")
    elif args.no_stage:
        print("\nFiles have been written but NOT staged. You can review with 'git diff'.")
    elif args.no_commit:
        print("\nChanges have been staged but NOT committed. Review with 'git diff --cached'.")
    else:
        should_commit = args.assume_yes
        if not should_commit:
            # Ask the user to review and confirm the commit
            user_input = input("\nWould you like to commit these changes? (y/n): ").strip().lower()
            should_commit = user_input == 'y'
        else:
            print("\nAuto-confirm enabled (--assume-yes). Committing changes...")

        if should_commit:
            author_info = 'transifex-translation-updater-bot <submittertech@gmail.com>'
            subprocess.run(['git', 'commit', '--author', author_info, '-m', commit_message])
            print("\nChanges have been committed.")
        else:
            # Revert the staging of the files
            subprocess.run(['git', 'reset', 'HEAD'])
            print("\nStaged changes have been reverted.")
else:
    print("\nNo changes detected in the translation files or languages.json.")
