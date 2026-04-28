# Map Transifex Migration

This directory contains the stable-key map migration tooling.

## Version Control

Commit these files:

- `scrapper/map-work/map_tx.py`
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
and stable Transifex keys. When the English map source changes, regenerate and commit only
`scrapper/map-work/map_tx_manifest.json`; the upload JSON can be regenerated from source.

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
