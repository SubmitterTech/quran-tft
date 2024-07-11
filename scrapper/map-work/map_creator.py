import json
import sys
import os
import re

def sort_dictionary(data):
    """ Recursively sort dictionary by keys. """
    if isinstance(data, dict):
        sorted_dict = {k: sort_dictionary(v) for k, v in sorted(data.items())}
        return sorted_dict
    return data

def extract_chapter(s):
    """ Extract the chapter number as an integer from a scripture reference. """
    match = re.match(r"(\d+)", s)
    if match:
        return int(match.group(1))
    return 0  # Default to zero if no number is found

def custom_sort_key(s):
    """ Sort keys by chapter number extracted from each reference. """
    parts = s.split(';')
    return [extract_chapter(part.strip()) for part in parts]

def concatenate_and_sort(values):
    """ Concatenate and sort scripture references by their chapter number. """
    concatenated_result = "; ".join(sorted(values, key=custom_sort_key))
    return concatenated_result

def reconstruct_dictionary(transformed_data):
    reconstructed_dict = {}

    for key, path in transformed_data.items():
        levels = path.split('\n')
        current_level = reconstructed_dict

        for i, part in enumerate(levels):
            is_last_level = (i == len(levels) - 1)  # Determine if at the last level
            if is_last_level:
                original_key = key.split('__', 1)[-1]
                if part in current_level and not isinstance(current_level[part], dict):
                    # Handling potential overwriting or concatenation
                    current_value = current_level[part]
                    # Split original_key and current_value to handle them as sets of discrete items
                    original_values = set(original_key.split(';'))
                    current_values = set(current_value.split(';'))

                    if current_values.issubset(original_values):
                        print(f"OVERRIDE: {part} \nOVERRIDE: existing: '{current_value}' with incoming: '{original_key}'")
                        current_level[part] = original_key
                    else:
                        # Concatenate unique values from both sets and sort them by chapter number
                        new_values = original_values.union(current_values)
                        concatenated_result = concatenate_and_sort(new_values)
                        print(f"CONCATENATE: {part} \nCONCATENATE: existing: '{current_value}'\nCONCATENATE: with incoming: '{original_key}' \nCONCATENATE: result is '{concatenated_result}'")
                        current_level[part] = concatenated_result
                        
                else:
                    # Setting values in the dictionary, handling non-dict types explicitly
                    if "empty" in key:
                        current_level[part] = ""  # Set empty string directly
                    else:
                        if part not in current_level:
                            current_level[part] = original_key
                        else:
                            if "" not in current_level[part]:
                                print(f"CREATE EMPTY KEY: {part}")
                                current_level[part][""] = original_key
            else:
                # Building or verifying the nested dictionary structure
                if part not in current_level:
                    current_level[part] = {}
                elif not isinstance(current_level[part], dict):
                    print(f"ERROR: Expected a dict at {part}, found {type(current_level[part])}. Adjusting structure.")
                    current_value = current_level[part]
                    current_level[part] = {"": current_value}  # Preserve current value under an empty key
                current_level = current_level[part]

    return sort_dictionary(reconstructed_dict)


def main():
    if len(sys.argv) != 2:
        print("Usage: python script.py <path_to_transformed_json>")
        sys.exit(1)

    input_path = sys.argv[1]
    input_filename = os.path.basename(input_path)
    output_filename = f"map_{input_filename}"
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
    print(f"\n\nNew JSON file created: {output_path}\n\n")


if __name__ == "__main__":
    main()
