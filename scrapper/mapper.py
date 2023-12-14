import json
import re

def extract_relations(text):
    """
    Extract relations from the provided text.
    """
    # Regular expression to match the sura:verse format
    regex = r'(\d+:\d+(?:-\d+|,\d+)?)'
    
    # Split the text by semicolon to handle different relation groups
    groups = text.split(';')
    relation_groups = []

    for group in groups:
        # Find all matches in the group
        found = re.findall(regex, group)
        if found:
            relation_groups.append(found)

    return relation_groups

# Load the json file
with open('index.json', 'r', encoding='utf-8') as file:
    data = json.load(file)

# Process each page
mapped_relations = {}
for page in data:
    # Extract relations from text
    page_relation_groups = extract_relations(page['text'])

    # Iterate through each group and store the relations
    for group in page_relation_groups:
        for relation in group:
            if relation not in mapped_relations:
                mapped_relations[relation] = set()

            # Add other related verses in the group excluding the current one
            mapped_relations[relation].update(set(group) - {relation})

# Convert sets to lists for JSON serialization
for key, value in mapped_relations.items():
    mapped_relations[key] = list(value)

# Write the relations to a JSON file
with open('map.json', 'w', encoding='utf-8') as out_file:
    json.dump(mapped_relations, out_file, ensure_ascii=False, indent=4)
