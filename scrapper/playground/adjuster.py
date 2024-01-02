import json

# Function to load a JSON file
def load_json(filename):
    with open(filename, 'r', encoding='utf-8') as file:
        return json.load(file)

# Function to save a dictionary to a JSON file
def save_json(data, filename):
    with open(filename, 'w', encoding='utf-8') as file:
        json.dump(data, file, indent=4, ensure_ascii=False)

# Load the data from files
changable = load_json('changable.json')
quran_tr = load_json('../../app/src/assets/translations/tr/quran_tr.json')

# Update the quran_tr file based on changable data
for reference, updated_text in changable.items():
    sura, verse = map(str, reference.split(':'))

    for page, content in quran_tr.items():
        if sura in content['sura']:
            if verse in content['sura'][sura]['verses']:
                quran_tr[page]['sura'][sura]['verses'][verse] = updated_text

# Save the updated data back to a new file
save_json(quran_tr, '../../app/src/assets/translations/tr/quran_tr.json')
