import json

# Load quran_tr.json
with open('../../../app/src/assets/translations/tr/quran_tr.json', 'r', encoding='utf-8') as file:
    quran_data_tr = json.load(file)

# Load quran_en.json
with open('../quran_en.json', 'r', encoding='utf-8') as file:
    quran_data_en = json.load(file)

mismatch_count = {}

# Function to count occurrences of a word in a string
def count_word(text, word):
    return text.count(word)

# Iterate through the suras in quran_tr.json and check against quran_en.json
for page, content_tr in quran_data_tr.items():
    content_en = quran_data_en[page]
    for sura_id in content_tr['sura']:
        verses_tr = content_tr['sura'][sura_id]['verses']
        verses_en = content_en['sura'][sura_id]['verses']
        # Check each verse in Turkish data for "TANRI"
        for verse_id, verse_text_tr in verses_tr.items():
            count_t = count_word(verse_text_tr, "TANRI")
            count = count_word(verses_en.get(verse_id, ""), "GOD")
            # Check if the counts do not match
            if count_t != count:
                if sura_id not in mismatch_count:
                    mismatch_count[sura_id] = {}
                mismatch_count[sura_id][verse_id] = {"TANRI": count_t, "GOD": count}
                print(f"Mismatch in {sura_id}:{verse_id} \t 'TANRI' count: {count_t}, 'GOD' count: {count}")

# Print mismatch counts
if mismatch_count:
    print("Mismatched counts of 'TANRI' and 'GOD' in verses:", mismatch_count)
else:
    print("No mismatches found in counts.")
