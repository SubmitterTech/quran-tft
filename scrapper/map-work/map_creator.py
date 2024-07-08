import json
import sys
import os

def sort_dictionary(data):
    """ Recursively sort dictionary by keys. """
    if isinstance(data, dict):
        sorted_dict = {}
        for key in sorted(data.keys()):
            sorted_dict[key] = sort_dictionary(data[key])
        return sorted_dict
    return data

def reconstruct_dictionary(transformed_data):
    reconstructed_dict = {}

    for key, path in transformed_data.items():
        levels = path.split('\n')
        current_level = reconstructed_dict

        for part in levels[:-1]:
            if part not in current_level:
                current_level[part] = {}
            current_level = current_level[part]

        # Assign either the original key value or an empty string for 'empty' keys
        if "empty" in key:
            current_level[levels[-1]] = ""  # Set empty entries to an empty string
        else:
            original_key = key.split('__', 1)[-1]
            current_level[levels[-1]] = original_key

    # Sort the dictionary before returning
    return sort_dictionary(reconstructed_dict)

def main():
    if len(sys.argv) != 2:
        print("Usage: python script.py <path_to_transformed_json>")
        sys.exit(1)

    input_path = sys.argv[1]
    input_filename = os.path.basename(input_path)
    output_filename = f"reconstructed_{input_filename}"
    output_path = os.path.join(os.getcwd(), output_filename)

    # Load the transformed JSON data from the file with UTF-8 encoding
    with open(input_path, 'r', encoding='utf-8') as file:
        transformed_data = json.load(file)

    # Reconstruct the original dictionary from the transformed JSON
    reconstructed_dict = reconstruct_dictionary(transformed_data)

    # Save the reconstructed dictionary to a JSON file with UTF-8 encoding in the script's working directory
    with open(output_path, 'w', encoding='utf-8') as file:
        json.dump(reconstructed_dict, file, indent=4, ensure_ascii=False)

    # Output the path of the newly created file
    print(f"New JSON file created: {output_path}")

if __name__ == "__main__":
    main()
