import json

# Load the structured_quran.json file
with open('reindexed_structured_quran.json', 'r', encoding='utf-8') as file:
    structured_quran = json.load(file)

# Load the translated_quran.json file
with open('tr_quran.json', 'r', encoding='utf-8') as file:
    translated_quran = json.load(file)

# Load the tr_titles.json file
with open('tr_titles.json', 'r', encoding='utf-8') as file:
    titles_quran = json.load(file)

# Global verse index
global_index = 1

# Check if the translated_quran is not empty
if translated_quran:
    for page in structured_quran.values():
        for sura_number, sura_info in page["sura"].items():
            for verse_number in sura_info["verses"]:
                # Check if the verse exists in translated_quran
                if str(global_index) in translated_quran:
                    sura_info["verses"][verse_number] = translated_quran[str(global_index)]

                # Add titles if they exist
                if sura_number in titles_quran and verse_number in titles_quran[sura_number]:
                    sura_info["titles"][verse_number] = titles_quran[sura_number][verse_number]

                global_index += 1
else:
    print("The translated_quran.json file is empty or incorrectly formatted.")

# Save the updated structured_quran.json file
with open('quran_tr.json', 'w', encoding='utf-8') as file:
    json.dump(structured_quran, file, ensure_ascii=False, indent=4)
