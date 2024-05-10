import json

def load_json_file(filepath):
    with open(filepath, 'r') as file:
        data = json.load(file)
    return data

def compare_encrypted_verses_sequentially(main_data, encrypted_reference):
    mismatched_verses = {}
    # Convert encrypted_reference to a list for easier sequential access
    encrypted_list = [encrypted_reference[str(i)] for i in range(1, len(encrypted_reference) + 1)]
    current_index = 0  # Start with the first verse in encrypted_quran.json

    for page, content in main_data.items():
        if 'sura' in content:  # Check if 'sura' key exists to avoid errors
            for sura_id, sura_content in content['sura'].items():
                for verse_id, verse_encrypted in sura_content.get('encrypted', {}).items():
                    if current_index < len(encrypted_list) and verse_encrypted != encrypted_list[current_index]:
                        mismatched_verses.setdefault(page, {}).setdefault(sura_id, {})[verse_id] = {
                            'actual': verse_encrypted,
                            'expected': encrypted_list[current_index],
                            'expected_index': current_index + 1  # Show expected index (1-based)
                        }
                    current_index += 1  # Move to the next verse in encrypted_quran.json

    return mismatched_verses

def print_mismatched_verses(mismatched_verses):
    for page, suras in mismatched_verses.items():
        print(f"Page {page}:")
        for sura, verses in suras.items():
            print(f"  Sura {sura}:")
            for verse_id, mismatch in verses.items():
                print(f"    Verse {verse_id}:")
                print(f"      Actual: {mismatch['actual']}")
                print(f"      Expected (Index {mismatch['expected_index']}): {mismatch['expected']}")

# Load the main data and the reference data
main_data_path = 'qurantft.json'
encrypted_reference_path = 'encrypted_quran.json'

main_data = load_json_file(main_data_path)
encrypted_reference = load_json_file(encrypted_reference_path)

# Compare encrypted verses sequentially
mismatched_verses = compare_encrypted_verses_sequentially(main_data, encrypted_reference)
print_mismatched_verses(mismatched_verses)
