import json

def generate_new_dict(data, path='', result=None):
    if result is None:
        result = {}

    for key, value in data.items():
        current_path = f"{key} => {path}" if path else key
        if isinstance(value, dict):
            generate_new_dict(value, current_path, result)
        elif isinstance(value, str) and value:
            result[value] = current_path if path else key

    return result

def compare_dicts(turkish_dict, english_dict):
    missing_keys = {key: turkish_dict[key] for key in turkish_dict if key not in english_dict}
    return missing_keys

def process_json(file_path):
    with open(file_path, 'r') as file:
        data = json.load(file)
    combined_dict = {}
    for key in data:
        combined_dict.update(generate_new_dict(data[key], key))
    return combined_dict

# Load and process the Turkish JSON
turkish_dict = process_json('../../app/src/assets/translations/tr/map_tr.json')

# Load and process the English JSON
english_dict = process_json('../../app/src/assets/map.json')

# Compare Turkish dictionary against English dictionary
missing_keys = compare_dicts(turkish_dict, english_dict)

# Output the missing keys
for key, value in missing_keys.items():
    formatted_value = value[:-4] if value.endswith(' => ') else value
    print(formatted_value + "                        ===== " + key)
