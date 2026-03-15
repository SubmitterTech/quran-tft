from __future__ import annotations

import json
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
QURAN_DE_PATH = BASE_DIR / "../../../app/src/assets/translations/de/quran_de.json"
QURAN_EN_PATH = BASE_DIR / "../quran_en.json"

def load_json(path: Path):
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def count_english_god(text: str) -> int:
    return text.count("GOD")


def count_german_god_forms(text: str) -> dict[str, int]:
    count_gottes = text.count("GOTTES")
    text_without_gottes = text.replace("GOTTES", "")

    counts = {
        "GOTT": text_without_gottes.count("GOTT"),
        "GOTTES": count_gottes,
    }

    return counts


quran_data_de = load_json(QURAN_DE_PATH)
quran_data_en = load_json(QURAN_EN_PATH)

mismatch_count: dict[str, dict[str, dict[str, int]]] = {}

for page, content_de in quran_data_de.items():
    content_en = quran_data_en[page]
    for sura_id in content_de["sura"]:
        verses_de = content_de["sura"][sura_id]["verses"]
        verses_en = content_en["sura"][sura_id]["verses"]

        for verse_id, verse_text_de in verses_de.items():
            german_counts = count_german_god_forms(verse_text_de)
            total_de = german_counts["GOTT"] + german_counts["GOTTES"]
            count_en = count_english_god(verses_en.get(verse_id, ""))

            if total_de != count_en:
                if sura_id not in mismatch_count:
                    mismatch_count[sura_id] = {}

                mismatch_count[sura_id][verse_id] = {
                    "GOTT": german_counts["GOTT"],
                    "GOTTES": german_counts["GOTTES"],
                    "DE_TOTAL": total_de,
                    "GOD": count_en,
                }
                print(
                    f"Mismatch in {sura_id}:{verse_id} \t "
                    f"'GOTT' count: {german_counts['GOTT']}, "
                    f"'GOTTES' count: {german_counts['GOTTES']}, "
                    f"German total: {total_de}, "
                    f"'GOD' count: {count_en}"
                )

if mismatch_count:
    print("Mismatched counts of German GOD forms and 'GOD' in verses:", mismatch_count)
else:
    print("No mismatches found in counts.")
