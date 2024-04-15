import json


# Load quran_tr.json
with open('../../../app/src/assets/translations/tr/quran_tr.json', 'r', encoding='utf-8') as file:
    quran_data_tr = json.load(file)

# Load quran_en.json
with open('../quran_en.json', 'r', encoding='utf-8') as file:
    quran_data_en = json.load(file)

missing_titles = {}

# Iterate through the suras in quran_tr.json and check against quran_en.json
for page, content_tr in quran_data_tr.items():
    content_en = quran_data_en[page]
    for sura_id in content_tr['sura']:
        titles_tr = content_tr['sura'][sura_id]['titles']
        titles_en = content_en['sura'][sura_id]['titles']
        # Check each title id in Turkish data
        for title_id in titles_tr:
            if title_id not in titles_en:
                if sura_id not in missing_titles:
                    missing_titles[sura_id] = []
                missing_titles[sura_id].append(title_id)
                print(
                    f"Missing Title in English: Sura {sura_id}, Title ID {title_id}")

# Print missing titles
if missing_titles:
    print("Missing Titles:", missing_titles)
else:
    print("No missing titles found.")
