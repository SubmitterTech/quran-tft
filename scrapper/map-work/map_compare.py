import json

def load_json_file(file_path):
    """Loads a JSON file and returns its content."""
    with open(file_path, 'r', encoding='utf-8') as file:
        return json.load(file)

def find_reference_in_tr(reference, tr_data, path=[]):
    """Recursively searches for the reference in map_tr.json."""
    for key, value in tr_data.items():
        if isinstance(value, dict):
            path_found = find_reference_in_tr(reference, value, path + [key])
            if path_found:
                return path_found
        elif reference in str(value):
            return path + [key]
    return []

def iterate_and_check(map_data, tr_data, path=[]):
    """Iterates through map.json and checks references in map_tr.json."""
    if isinstance(map_data, dict):
        for key, value in map_data.items():
            iterate_and_check(value, tr_data, path + [key])
    elif isinstance(map_data, list) or isinstance(map_data, str):
        if isinstance(map_data, str):
            map_data = [map_data]  # Convert string to list for uniform processing
        for item in map_data:
            references = item.split('; ')
            for ref in references:
                if not find_reference_in_tr(ref, tr_data):
                    print(f"Reference '{ref}' not found. Path: {' > '.join(path)}")
                    print(" ");

# Load the JSON files
map_data = load_json_file('map.json')
tr_data = load_json_file('map_tr.json')

# Start the iteration and check process
iterate_and_check(map_data, tr_data)
