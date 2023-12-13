import json

# Load the structured_quran.json file
with open('reindexed_structured_quran.json', 'r', encoding='utf-8') as file:
    structured_quran = json.load(file)

# Load the encrypted_quran.json file
with open('encrypted_quran.json', 'r', encoding='utf-8') as file:
    encrypted_quran = json.load(file)

# Global verse index
global_index = 1

# Check if the encrypted_quran is not empty
if encrypted_quran:
    for page in structured_quran.values():
        for sura_number, sura_info in page["sura"].items():
            sura_info["encrypted"] = {}  # Initialize the encrypted key
            for verse_number in sura_info["verses"]:
                # Check if the verse exists in encrypted_quran
                if str(global_index) in encrypted_quran:
                    # Add the verse to the encrypted key
                    sura_info["encrypted"][verse_number] = encrypted_quran[str(global_index)]
                global_index += 1
else:
    print("The encrypted_quran.json file is empty or incorrectly formatted.")

# Save the updated structured_quran.json file
with open('quran.json', 'w', encoding='utf-8') as file:
    json.dump(structured_quran, file, ensure_ascii=False, indent=4)
