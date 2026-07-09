# Map Transifex Migration

This directory contains the stable-key map migration tooling.

## Reference Correction Runbook

Use this flow when an English reference in the map is corrected and the
Transifex `mapjson` source must be replaced.

Prerequisites:

- `scrapper/.venv/bin/python` exists and has the Transifex dependencies.
- `scrapper/translation-work/transifex-api-key` exists locally.
- `scrapper/translation-work/supported-languages.json` exists locally.
- The working tree is clean enough that generated local map changes can be
  reviewed clearly.

Do not edit `scrapper/scraping-work/map.json` for this flow. The Transifex map
source is generated from `app/src/assets/map.json`.

Run order:

1. Edit the English source map at `app/src/assets/map.json`.

2. Check that the JSON still parses:

   ```bash
   ./scrapper/.venv/bin/python -m json.tool app/src/assets/map.json >/dev/null
   ```

3. Pull the latest Transifex target map payloads, regenerate the source upload
   file and manifest, re-key target uploads, and update local client map files:

   ```bash
   ./scrapper/.venv/bin/python scrapper/map-work/prepare_map_update.py
   ```

   The script prints the generated `<out-dir>`, usually
   `scrapper/map-work/out/map-update-<timestamp>`.

4. Review generated reports before uploading anything to Transifex:

   - `<out-dir>/reports/source-stability-check.json`: `failure_count` must be `0`.
   - `<out-dir>/reports/target-rekey-summary.tsv`: `missing_path_hashes`,
     `invalid_stable_keys`, `bad_roots_written`, and `non_string_values` must be
     `0` for every language.
   - `<out-dir>/reports/upload-validation.tsv`: `extra_keys`, `blank_values`,
     `source_matches`, `bad_roots`, and `non_string_values` must be `0` for
     every generated upload file.
   - `<out-dir>/reports/local-map-update-summary.tsv`: `bad_top_level_count`
     must be `0` for every language.

   `blank_values` and `source_matches_omitted` in `target-rekey-summary.tsv` are
   expected for partial languages. A reference-only correction should normally
   show `reference_key_remaps` for the corrected row.

5. Upload to Transifex manually in this order. The repository does not include
   an upload script for this step:

   1. Replace the `mapjson` source resource with
      `<out-dir>/stable/source_map.json`.
   2. Upload each `<out-dir>/stable/map_<lang>.json` file to the matching
      target language.

6. Commit only durable repository changes:

   - `app/src/assets/map.json`
   - `scrapper/map-work/map_tx_manifest.json`
   - changed `app/src/assets/translations/<lang>/map_<lang>.json` files

   Do not commit `scrapper/map-work/out/**`, raw Transifex downloads, audit TSV
   files, or generated upload JSON files.

Do not run an extra `pull_translations.py` map pull just to refresh local maps
after this reference-only flow. `prepare_map_update.py` already updates local
client map files from the same raw snapshot and the new manifest.

## Version Control

Commit these files:

- `scrapper/map-work/map_tx.py`
- `scrapper/map-work/prepare_map_update.py`
- `scrapper/map-work/map_tx_manifest.json`
- `scrapper/map-work/README.md`
- `scrapper/translation-work/pull_translations.py`
- `.gitignore`

Do not commit generated migration artifacts:

- `scrapper/map-work/out/**`
- raw Transifex downloads
- audit TSV files
- generated source/translation upload JSON files

The manifest is the durable contract between the current English `app/src/assets/map.json`
and stable Transifex keys. When the English map source changes, regenerate and commit
`scrapper/map-work/map_tx_manifest.json` alongside the source map and updated local
client maps; generated upload JSON can be regenerated from source.

## Source Map Update

When `app/src/assets/map.json` changes, run one preparation command before
touching the Transifex source resource:

```bash
./scrapper/.venv/bin/python scrapper/map-work/prepare_map_update.py
```

This command:

- downloads the latest `mapjson` target payloads from Transifex as raw JSON,
- exports the updated English source upload JSON,
- regenerates `scrapper/map-work/map_tx_manifest.json`,
- re-keys target translations by the stable path hash,
- updates local `app/src/assets/translations/<lang>/map_<lang>.json` files from
  the same raw snapshot and new manifest,
- omits blank values and values that still match the English source path,
- writes TSV audit reports under the generated output directory.

Upload order:

1. Replace the Transifex `mapjson` source with `<out-dir>/stable/source_map.json`.
2. Upload `<out-dir>/stable/map_<lang>.json` to the matching target languages.

Local map files are updated by the preparation command itself. Do not run an
extra map pull just to update local references after a reference-only source map
change.

Review `<out-dir>/reports/target-rekey-summary.tsv` before uploading. Any non-zero
`missing_path_hashes` means a source path changed and that translation could not be
automatically moved to the new source map.

## Generate Source Upload

```bash
./scrapper/.venv/bin/python scrapper/map-work/map_tx.py export \
  app/src/assets/map.json \
  --out scrapper/map-work/out/tx-onlytranslated/stable/source_map.json \
  --manifest scrapper/map-work/map_tx_manifest.json
```

Upload this file to Transifex as the `mapjson` source resource:

- `scrapper/map-work/out/tx-onlytranslated/stable/source_map.json`

## Translation Upload Files

After source replacement, upload generated language files matching this pattern:

- `scrapper/map-work/out/tx-onlytranslated/stable/map_<lang>.json`

Partial languages must stay partial. Empty values and untranslated blank payloads should not
exist in the upload JSON.

## Validate

```bash
./scrapper/.venv/bin/python scrapper/map-work/map_tx.py stability-check \
  app/src/assets/map.json \
  --out scrapper/map-work/out/tx-onlytranslated/source-stability-check.json
```

The expected result is `Key shift failures: 0`.
