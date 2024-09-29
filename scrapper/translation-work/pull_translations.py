from transifex.api import transifex_api
import requests
import json
import os
import re
import subprocess

# Read the API token from the 'transifex-api-key' file
with open('transifex-api-key', 'r') as token_file:
    api_token = token_file.read().strip()

# Initialize the Transifex API with the credentials
transifex_api.setup(auth=api_token)

# Define the project and resource details
organization_slug = 'submittertech'
project_slug = 'quranthefinaltestament'
resource_slugs = [
    'coverjson',
    'introductionjson',
    'quranjson',
    'applicationjson',
    'mapjson',
    'appendicesjson'
]

# Language codes and their corresponding language names
language_codes = ['tr', 'fr', 'de', 'fa']  # Turkish, French, German, Persian
language_names = {
    'tr': 'Turkish',
    'fr': 'French',
    'de': 'German',
    'fa': 'Persian'
}

# Fetch organization and project
organization = transifex_api.Organization.get(slug=organization_slug)
project = organization.fetch('projects').get(slug=project_slug)

# Base path for saving translations
base_path = '../../app/src/assets/translations'

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

updated_languages = set()  # Keep track of languages with changes

for language_code in language_codes:
    # Ensure the language directory exists
    lang_dir = os.path.join(base_path, language_code)
    os.makedirs(lang_dir, exist_ok=True)
    
    # Fetch the language object
    language = transifex_api.Language.get(code=language_code)
    
    for resource_slug in resource_slugs:
        # Fetch the resource
        resource = project.fetch('resources').get(slug=resource_slug)
        
        # Fetch the URL for downloading translations
        url = transifex_api.ResourceTranslationsAsyncDownload.download(
            resource=resource, language=language
        )
        
        # Get the translated content
        response = requests.get(url)
        translated_content = json.loads(response.text)  # Parse JSON response
        
        # Define the output file path
        resource_name = resource_slug.replace('json', '')
        output_filename = f"{resource_name}_{language_code}.json"
        output_path = os.path.join(lang_dir, output_filename)
        
        if resource_slug == 'mapjson':
            # Manipulate the map data using the provided code
            transformed_data = translated_content  # Assuming the translated content is in the transformed format

            # Reconstruct the original dictionary from the transformed JSON
            reconstructed_dict = reconstruct_dictionary(transformed_data)

            # Write the manipulated content to the file
            with open(output_path, 'w', encoding='utf-8') as new_file:
                json.dump(reconstructed_dict, new_file, ensure_ascii=False, indent=4)
        else:
            # Write the content to the file without ASCII escaping
            with open(output_path, 'w', encoding='utf-8') as new_file:
                json.dump(translated_content, new_file, ensure_ascii=False, indent=4)
        
        print(f"Saved {output_path}")
        
    # After saving files for a language, check if there are changes
    # Run 'git status --porcelain' to check for changes in the language directory
    lang_status = subprocess.run(['git', 'status', '--porcelain', lang_dir], capture_output=True, text=True)
    if lang_status.stdout.strip():
        # There are changes in this language directory
        updated_languages.add(language_code)
        # Stage the changed files
        subprocess.run(['git', 'add', lang_dir])

if updated_languages:
    # Map language codes to language names
    updated_language_names = [language_names[code] for code in sorted(updated_languages)]
    languages_str = ', '.join(updated_language_names)
    commit_message = f"Update {languages_str} from Transifex"

    print("\nThe following languages have been updated and staged for commit:")
    print(languages_str)
    print(f"\nCommit message: '{commit_message}'")

    # Ask the user to review and confirm the commit
    user_input = input("\nWould you like to commit these changes? (y/n): ").strip().lower()
    if user_input == 'y':
        # Commit the changes with the specified author
        author_info = 'transifex-translation-updater-bot <submittertech@gmail.com>'
        subprocess.run(['git', 'commit', '--author', author_info, '-m', commit_message])
        print("\nChanges have been committed.")
    else:
        # Revert the staging of the files
        for language_code in updated_languages:
            lang_dir = os.path.join(base_path, language_code)
            subprocess.run(['git', 'reset', 'HEAD', lang_dir])
        print("\nStaged changes have been reverted.")
else:
    print("\nNo changes detected in the translation files.")