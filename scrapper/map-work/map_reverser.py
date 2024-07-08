import json
import sys
import os

def generate_new_dict(data, path='', result=None, empty_entries=None):
    if result is None:
        result = {}
    if empty_entries is None:
        empty_entries = {}

    for key, value in data.items():
        current_path = f"{path}\n{key}" if path else key
        if isinstance(value, dict):
            # Recurse into nested dictionary
            generate_new_dict(value, current_path, result, empty_entries)
        elif isinstance(value, str):
            if value.strip():
                # Use the entire string of scripture references as a single key, prepended with "0__"
                ref = f"0__{value.strip()}"
                if ref in result:
                    # Strip "0__" and prepare to generate a new unique key for duplicate references
                    base_ref = value.strip()
                    i = 1
                    new_ref = f"{i}__{base_ref}"
                    while new_ref in result:
                        i += 1
                        new_ref = f"{i}__{base_ref}"
                    result[new_ref] = current_path if path else key
                else:
                    result[ref] = current_path if path else key
            else:
                # Create a unique key for each empty value by counting existing empty entries
                empty_key = f"empty_{len(empty_entries) + 1}"
                empty_entries[empty_key] = current_path if path else key

    # After processing all items, add the uniquely keyed empty entries to the main result
    if empty_entries:
        result.update(empty_entries)

    return result

def main():
    if len(sys.argv) != 2:
        print("Usage: python script.py <path_to_input_json>")
        sys.exit(1)

    input_path = sys.argv[1]
    input_filename = os.path.basename(input_path)
    output_path = os.path.join(os.getcwd(), f"transformed_{input_filename}")

    # Load the JSON data from the file with UTF-8 encoding
    with open(input_path, 'r', encoding='utf-8') as file:
        map_tr = json.load(file)

    # Process the entire JSON data, assuming the top level is the entry point
    new_dict = generate_new_dict(map_tr)

    # Save the new dictionary to a JSON file with UTF-8 encoding in the script's working directory
    with open(output_path, 'w', encoding='utf-8') as file:
        json.dump(new_dict, file, indent=4, sort_keys=True, ensure_ascii=False)

    # Output the path of the newly created file
    print(f"New JSON file created: {output_path}")

if __name__ == "__main__":
    main()
