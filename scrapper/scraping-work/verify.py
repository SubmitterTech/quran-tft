import json

# Load the reindexed_structured_quran.json file
with open('reindexed_structured_quran.json', 'r', encoding='utf-8') as file:
    reindexed_structured_quran = json.load(file)

# Load the surah.json file
with open('surah.json', 'r', encoding='utf-8') as file:
    surah_info = json.load(file)

# Function to count verses in each sura
def count_verses(structured_quran):
    verse_counts = {}
    for page in structured_quran.values():
        for sura_number, sura_info in page["sura"].items():
            verse_counts[sura_number] = verse_counts.get(sura_number, 0) + len(sura_info["verses"])
    return verse_counts

# Function to verify the structured quran data
def verify_quran_structured_data(verse_counts, surah_data):
    missing_verses_info = []

    for sura_number, sura_data in surah_data.items():
        str_sura_number = str(sura_number)
        expected_verse_count = sura_data['nAyah']
        actual_verse_count = verse_counts.get(str_sura_number, 0)

        if actual_verse_count != expected_verse_count:
            missing_verses_info.append(
                f"Sura {sura_number}: Expected {expected_verse_count} verses, found {actual_verse_count}")

    return missing_verses_info

# Count the verses in the structured quran
verse_counts = count_verses(reindexed_structured_quran)

# Perform the verification
missing_verses_info = verify_quran_structured_data(verse_counts, surah_info)

# Print the result
if missing_verses_info:
    print("Missing verses found:")
    for info in missing_verses_info:
        print(info)
else:
    print("No missing verses. Verification successful.")
