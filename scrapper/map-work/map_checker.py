import json

def load_json_file(file_path):
    """Loads a JSON file and returns its content."""
    with open(file_path, 'r', encoding='utf-8') as file:
        return json.load(file)

def check_references_for_colon(map_data, path=[]):
    """Iterates through map.json and checks each reference for the ':' character."""
    if isinstance(map_data, dict):
        for key, value in map_data.items():
            check_references_for_colon(value, path + [key])
    elif isinstance(map_data, list) or isinstance(map_data, str):
        if isinstance(map_data, str):
            map_data = [map_data]  # Convert string to list for uniform processing
        for item in map_data:
            references = item.split('; ')
            for ref in references:
                # Check if ':' is missing in the reference
                if ':' not in ref:
                    # Print the full reference for clarity
                    print(f"Reference missing ':' => '{ref}'. Path: {' > '.join(path)}")

# Load the JSON file
map_data = load_json_file('map.json')

# Start the iteration and check process
check_references_for_colon(map_data)
