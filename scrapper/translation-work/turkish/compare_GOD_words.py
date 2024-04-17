import json

# Load quran_tr.json
with open('../../../app/src/assets/translations/tr/quran_tr.json', 'r', encoding='utf-8') as file:
    quran_data_tr = json.load(file)

# Load quran_en.json
with open('../quran_en.json', 'r', encoding='utf-8') as file:
    quran_data_en = json.load(file)

missing_God_words = {}

# Iterate through the suras in quran_tr.json and check against quran_en.json
for page, content_tr in quran_data_tr.items():
    content_en = quran_data_en[page]
    for sura_id in content_tr['sura']:
        verses_tr = content_tr['sura'][sura_id]['verses']
        verses_en = content_en['sura'][sura_id]['verses']
        # Check each verse in Turkish data for "TANRI"
        for verse_id, verse_text_tr in verses_tr.items():
            if "TANRI" in verse_text_tr:
                # Check the same verse_id in English data for "GOD"
                if verse_id in verses_en and "GOD" not in verses_en[verse_id]:
                    if sura_id not in missing_God_words:
                        missing_God_words[sura_id] = []
                    missing_God_words[sura_id].append(verse_id)
                    print(f"Not complete verse in English {sura_id}:{verse_id}")

# Print missing 'GOD' in verses
if missing_God_words:
    print("Not complete verses:", missing_God_words)
else:
    print("No missing 'GOD' found.")
