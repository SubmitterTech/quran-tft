# Since the full JSON structure isn't provided, we'll outline a Python code snippet that achieves the user's goal
# for a hypothetical JSON structure that contains pages numbered from 23 to 394.
# This snippet will remove the specified keys ('cumulativefrequencyofthewordGOD', 'cumulativesumofverseswhereGODwordoccurs', 'encrypted')
# from each page and then save the modified JSON to a new file.

import json

# Hypothetical loading of the original JSON file - replace 'your_json_file.json' with your actual file path
with open('qurantft.json', 'r') as file:
    data = json.load(file)

# Iterate over pages 23 to 394 and remove the specified keys
for page_number in range(23, 395):  # Including 394
    page_str = str(page_number)
    if page_str in data:
        if 'notes' in data[page_str]:
            data[page_str]['notes'].pop('cumulativefrequencyofthewordGOD', None)
            data[page_str]['notes'].pop('cumulativesumofverseswhereGODwordoccurs', None)
        if 'sura' in data[page_str]:
            for sura in data[page_str]['sura'].values():
                sura.pop('encrypted', None)

# Write the modified JSON data to a new file
with open('quran_en.json', 'w', encoding='utf-8') as new_file:
    json.dump(data, new_file, ensure_ascii=False, indent=4)

# Note: This is a template code, you need to adjust file paths and possibly the structure navigation
# depending on the actual structure of your JSON file.
