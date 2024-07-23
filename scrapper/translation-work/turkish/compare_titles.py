import json

# Load quran_tr.json
with open('../../../app/src/assets/translations/tr/quran_tr.json', 'r', encoding='utf-8') as file:
    quran_data_tr = json.load(file)

# Load quran_en.json
with open('../quran_en.json', 'r', encoding='utf-8') as file:
    quran_data_en = json.load(file)

missing_titles = {}
line_break_differences = {}

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
                print(f"Missing Title in English: Sura {sura_id}, Title ID {title_id}")
            else:
                # Check the number of line breaks in titles
                count_tr = titles_tr[title_id].count('\n')
                count_en = titles_en[title_id].count('\n')
                if count_tr != count_en:
                    if sura_id not in line_break_differences:
                        line_break_differences[sura_id] = {}
                    line_break_differences[sura_id][title_id] = {
                        'tr': count_tr,
                        'en': count_en
                    }

# Print results
if missing_titles:
    print("Missing Titles:", missing_titles)

if line_break_differences:
    for sura_id, titles in line_break_differences.items():
        for title_id, counts in titles.items():
            print(f"key:sura.{sura_id}.titles.{title_id}  \tline breaks TR,EN => {counts['tr']},{counts['en']}")
else:
    print("No line break differences found.")
