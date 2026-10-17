from __future__ import annotations

import json
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
QURAN_SV_PATH = BASE_DIR / "../../../app/src/assets/translations/sv/quran_sv.json"
QURAN_EN_PATH = BASE_DIR / "../quran_en.json"

GENITIVE_FORMS = ("GUD’s", "GUD's")

def load_json(path: Path):
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def count_english_god(text: str) -> int:
    return text.count("GOD")


def count_swedish_god_forms(text: str) -> dict[str, int]:
    count_guds = sum(text.count(form) for form in GENITIVE_FORMS)
    text_without_guds = text
    for form in GENITIVE_FORMS:
        text_without_guds = text_without_guds.replace(form, "")

    counts = {
        "GUD": text_without_guds.count("GUD"),
        "GUDS": count_guds,
    }

    return counts


quran_data_sv = load_json(QURAN_SV_PATH)
quran_data_en = load_json(QURAN_EN_PATH)

mismatch_count: dict[str, dict[str, dict[str, int]]] = {}

for page, content_sv in quran_data_sv.items():
    content_en = quran_data_en[page]
    for sura_id in content_sv["sura"]:
        verses_sv = content_sv["sura"][sura_id]["verses"]
        verses_en = content_en["sura"][sura_id]["verses"]

        for verse_id, verse_text_sv in verses_sv.items():
            swedish_counts = count_swedish_god_forms(verse_text_sv)
            total_sv = swedish_counts["GUD"] + swedish_counts["GUDS"]
            count_en = count_english_god(verses_en.get(verse_id, ""))

            if total_sv != count_en:
                if sura_id not in mismatch_count:
                    mismatch_count[sura_id] = {}

                mismatch_count[sura_id][verse_id] = {
                    "GUD": swedish_counts["GUD"],
                    "GUDS": swedish_counts["GUDS"],
                    "SV_TOTAL": total_sv,
                    "GOD": count_en,
                }
                print(
                    f"Mismatch in {sura_id}:{verse_id} \t "
                    f"'GUD' count: {swedish_counts['GUD']}, "
                    f"'GUDS' count: {swedish_counts['GUDS']}, "
                    f"Swedish total: {total_sv}, "
                    f"'GOD' count: {count_en}"
                )

if mismatch_count:
    print("Mismatched counts of Swedish GOD forms and 'GOD' in verses:", mismatch_count)
else:
    print("No mismatches found in counts.")
