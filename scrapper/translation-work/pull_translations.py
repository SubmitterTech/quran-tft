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
# Turkish, French, German, Persian, Russian
language_codes = ['tr', 'fr', 'de', 'fa', 'ru']

language_names = {
    'tr': 'Turkish',
    'fr': 'French',
    'de': 'German',
    'fa': 'Persian',
    'ru': 'Russian'
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

def extract_chapter_verse_pairs(s):
    """Extract all (chapter, verse) pairs as integers from a scripture reference."""
    s = s.strip()
    refs = re.split(r'[;,]', s)
    chapter_verse_pairs = []
    for ref in refs:
        ref = ref.strip()
        # Handle ranges like '4:11-12' or '9:23-24'
        match = re.match(r'(\d+):(\d+)(?:-(\d+))?', ref)
        if match:
            chapter = int(match.group(1))
            verse_start = int(match.group(2))
            verse_end = int(match.group(3)) if match.group(3) else verse_start
            chapter_verse_pairs.append((chapter, verse_start))
        else:
            # Handle single chapters or verses without ranges
            match = re.match(r'(\d+)(?::(\d+))?', ref)
            if match:
                chapter = int(match.group(1))
                verse = int(match.group(2)) if match.group(2) else 0
                chapter_verse_pairs.append((chapter, verse))
    return chapter_verse_pairs

def custom_sort_key(s):
    """Generate a sorting key based on the earliest (chapter, verse) in the reference."""
    chapter_verse_pairs = extract_chapter_verse_pairs(s)
    if chapter_verse_pairs:
        return min(chapter_verse_pairs)
    else:
        return (float('inf'), float('inf'))

def concatenate_and_sort(values):
    """Concatenate and sort scripture references by their chapter and verse numbers."""
    sorted_values = sorted(values, key=custom_sort_key)
    concatenated_result = "; ".join(sorted_values)
    return concatenated_result

def reconstruct_dictionary(transformed_data):
    reconstructed_dict = {}

    for key, path in transformed_data.items():
        levels = path.split('\n')
        current_level = reconstructed_dict

        for i, part in enumerate(levels):
            # Determine if at the last level
            is_last_level = (i == len(levels) - 1)
            if is_last_level:
                original_key = key.split('__', 1)[-1]
                if part in current_level and not isinstance(current_level[part], dict):
                    # Handling potential overwriting or concatenation
                    current_value = current_level[part]
                    # Split original_key and current_value to handle them as sets of discrete items
                    original_values = set(original_key.split(';'))
                    current_values = set(current_value.split(';'))

                    if current_values.issubset(original_values):
                        print(
                            f"OVERRIDE: {part} \nOVERRIDE: existing: '{current_value}' with incoming: '{original_key}'")
                        current_level[part] = original_key
                    else:
                        # Concatenate unique values from both sets and sort them by chapter number
                        new_values = original_values.union(current_values)
                        concatenated_result = concatenate_and_sort(new_values)
                        print(
                            f"CONCATENATE: {part} \nCONCATENATE: existing: '{current_value}'\nCONCATENATE: with incoming: '{original_key}' \nCONCATENATE: result is '{concatenated_result}'")
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
                    print(
                        f"ERROR: Expected a dict at {part}, found {type(current_level[part])}. Adjusting structure.")
                    current_value = current_level[part]
                    # Preserve current value under an empty key
                    current_level[part] = {"": current_value}
                current_level = current_level[part]

    return sort_dictionary(reconstructed_dict)


updated_languages = set()  # Keep track of languages with changes

for language_code in language_codes:
    # Fetch the language object
    language = transifex_api.Language.get(code=language_code)

    # Initialize a flag to check if any files were saved for this language
    files_saved = False

    for resource_slug in resource_slugs:
        # Fetch the resource
        resource = project.fetch('resources').get(slug=resource_slug)

        # Fetch the URL for downloading translations
        url = transifex_api.ResourceTranslationsAsyncDownload.download(
            resource=resource, language=language
        )

        # Get the translated content
        response = requests.get(url)
        response.encoding = 'utf-8'  # Ensure the response is decoded using UTF-8
        
        # Define the output file path
        lang_dir = os.path.join(base_path, language_code)
        resource_name = resource_slug.replace('json', '')
        output_filename = f"{resource_name}_{language_code}.json"
        output_path = os.path.join(lang_dir, output_filename)
        
        # Try to parse the JSON response
        try:
            translated_content = json.loads(response.text)
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON for language '{language_code}' and resource '{resource_slug}': {e}")
            
            # Check if this is the known issue with Russian 'appendicesjson'
            if language_code == 'ru' and resource_slug == 'appendicesjson':
                print("Attempting to fix known control character issue in Russian 'appendicesjson'...")
                # Replace the specific control character (\x02) with a hyphen or appropriate character
                cleaned_text = response.text.replace('\x02', '-')
                
                # Try parsing again
                try:
                    translated_content = json.loads(cleaned_text)
                    print("Successfully parsed JSON after cleaning.")
                except json.JSONDecodeError as e_inner:
                    print(f"Failed to parse cleaned JSON for '{language_code}' and '{resource_slug}': {e_inner}")
                    # Skip to the next resource if parsing still fails
                    continue
            else:
                # For other cases, re-raise the exception
                raise

        # Only proceed if there is content to save
        if translated_content:
            # Ensure the language directory exists
            os.makedirs(lang_dir, exist_ok=True)
            files_saved = True  # Mark that we have files to save for this language

            if resource_slug == 'mapjson':
                # Manipulate the map data using the provided code
                # Assuming the translated content is in the transformed format
                transformed_data = translated_content

                # Reconstruct the original dictionary from the transformed JSON
                reconstructed_dict = reconstruct_dictionary(transformed_data)

                # Write the manipulated content to the file
                with open(output_path, 'w', encoding='utf-8') as new_file:
                    json.dump(reconstructed_dict, new_file,
                              ensure_ascii=False, indent=4)
            else:
                # Write the content to the file without ASCII escaping
                with open(output_path, 'w', encoding='utf-8') as new_file:
                    json.dump(translated_content, new_file,
                              ensure_ascii=False, indent=4)

            print(f"Saved {output_path}")

    if files_saved:
        # After saving files for a language, check if there are changes
        lang_dir = os.path.join(base_path, language_code)
        lang_status = subprocess.run(
            ['git', 'status', '--porcelain', lang_dir], capture_output=True, text=True)
        if lang_status.stdout.strip():
            # There are changes in this language directory
            updated_languages.add(language_code)
            # Stage the changed files
            subprocess.run(['git', 'add', lang_dir])

# Path to the languages.json file
languages_json_path = '../../app/src/assets/languages.json'

# Load the existing languages.json file
with open(languages_json_path, 'r', encoding='utf-8') as f:
    languages_data = json.load(f)

# --- Update languages.json with completeness percentages ---

# Fetch project language stats
project_stats = transifex_api.ResourceLanguageStats.filter(project=project)

# Calculate completeness percentage per language
completeness_percentages = {}

for stat in project_stats:
    # Parse language and resource details from the string output
    language_str = str(stat.language)

    # Extract language code from the unfetched string representation
    language_code = language_str.split(': ')[1].split(' ')[0].replace('l:', '')

    # Skip the source language (en)
    if language_code == 'en':
        continue

    translated_strings = stat.attributes['translated_strings']
    total_strings = stat.attributes['total_strings']

    # Calculate completeness percentage
    if language_code not in completeness_percentages:
        completeness_percentages[language_code] = {
            'translated_strings': 0, 'total_strings': 0}

    completeness_percentages[language_code]['translated_strings'] += translated_strings
    completeness_percentages[language_code]['total_strings'] += total_strings

# Update the 'comp' values in languages_data
languages_json_changed = False
for language_code, stats in completeness_percentages.items():
    total_strings = stats['total_strings']
    translated_strings = stats['translated_strings']
    completeness_percentage = (
        translated_strings / total_strings) * 100 if total_strings else 0

    # Round the completeness percentage to two decimal places
    completeness_percentage = round(completeness_percentage, 2)

    # If the percentage is a whole number, convert it to int
    if completeness_percentage.is_integer():
        completeness_percentage = int(completeness_percentage)

    # Update the 'comp' value if the language exists in languages_data
    if language_code in languages_data:
        old_comp = languages_data[language_code].get('comp', None)
        languages_data[language_code]['comp'] = completeness_percentage
        if old_comp != completeness_percentage:
            languages_json_changed = True
            print(
                f"Updated {language_code} completeness to {completeness_percentage}%")
    else:
        print(f"Language {language_code} not found in languages.json")

# Save the updated languages.json file if changes were made
if languages_json_changed:
    with open(languages_json_path, 'w', encoding='utf-8') as f:
        json.dump(languages_data, f, indent=4, ensure_ascii=False)
    # Stage languages.json for commit
    subprocess.run(['git', 'add', languages_json_path])
    print(f"Staged {languages_json_path} for commit")

if updated_languages or languages_json_changed:
    # Map language codes to language names
    updated_language_names = [language_names.get(
        code, code) for code in sorted(updated_languages)]
    languages_str = ', '.join(updated_language_names)
    commit_message = f"Update {languages_str} from Transifex"

    print("\nThe following languages have been updated and staged for commit:")
    if updated_language_names:
        print(languages_str)
    if languages_json_changed:
        print("languages.json has been updated with new completeness percentages.")
    print(f"\nCommit message: '{commit_message}'")

    # Ask the user to review and confirm the commit
    user_input = input(
        "\nWould you like to commit these changes? (y/n): ").strip().lower()
    if user_input == 'y':
        # Commit the changes with the specified author
        author_info = 'transifex-translation-updater-bot <submittertech@gmail.com>'
        subprocess.run(['git', 'commit', '--author',
                       author_info, '-m', commit_message])
        print("\nChanges have been committed.")
    else:
        # Revert the staging of the files
        subprocess.run(['git', 'reset', 'HEAD'])
        print("\nStaged changes have been reverted.")
else:
    print("\nNo changes detected in the translation files or languages.json.")
