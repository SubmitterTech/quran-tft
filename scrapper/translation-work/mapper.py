import json
import re
from collections import defaultdict
from collections import OrderedDict

def parse_index(entries):
    dictionary = defaultdict(lambda: defaultdict(dict))
    current_main_key = ''
    current_sub_key = ''

    for entry in entries:
        entry = entry.strip().replace(' ', ' ')
        if len(entry) == 0:
            continue  # Ignore empty line
        pattern = r'\d+\s*:\s*\d+(?:\s*-\s*\d+)?(?:\s*,\s*\d+(?:\s*-\s*\d+)?)*'

        if re.search(r'\d+', entry):
            if re.search(r'%', entry):
                entry = entry.split('%')[1].strip()

                if current_sub_key in dictionary[current_main_key]:
                    theme = re.sub(pattern, '', entry).replace(';', '').strip()
                    references = re.findall(pattern, entry)

                    references_str = '; '.join(references)
                    dictionary[current_main_key][current_sub_key][theme] = references_str
                else:
                    dictionary[current_main_key][current_sub_key] = {}

            else:
                references = re.findall(pattern, entry)
                if len(references) != 0:
                    current_sub_key = re.sub(pattern, '', entry).replace(';', '').strip()
                    current_main_key = current_sub_key[0]

                    if current_main_key not in dictionary:
                        dictionary[current_main_key] = {}
                    if current_sub_key not in dictionary[current_main_key]:
                        dictionary[current_main_key][current_sub_key] = {}

                    references_str = '; '.join(references)
                    dictionary[current_main_key][current_sub_key][""] = references_str
                else:
                    dictionary[current_main_key][current_sub_key] = {}

        else:
            if len(entry) > 1:
                if re.search(r'%', entry):
                    dictionary[current_main_key][current_sub_key] = {}
                else:
                    current_sub_key = entry
                    current_main_key = current_sub_key[0]
                    if current_main_key not in dictionary:
                        dictionary[current_main_key] = {}
                    if current_sub_key not in dictionary[current_main_key]:
                        dictionary[current_main_key][current_sub_key] = {}

    return {k: dict(v) for k, v in dictionary.items()}


all_entries = []
with open('index.txt', 'r', encoding='utf-8') as file:
    cnt = 0
    for line in file:
        all_entries.append(line)
        # cnt = cnt + 1
        # if(cnt > 200):
        #     break


parsed_index = parse_index(all_entries)

for main_key in parsed_index:
    for sub_key in parsed_index[main_key]:
        for theme, references in parsed_index[main_key][sub_key].items():
            if theme:
                if re.search(r'\d+', theme):
                    print(theme)
            else:
                if len(parsed_index[main_key][sub_key].keys()) == 1:
                    parsed_index[main_key][sub_key] = parsed_index[main_key][sub_key][""]

def sort_dict(d):
    # Sort the main keys
    sorted_dict = OrderedDict(sorted(d.items(), key=lambda x: x[0]))

    for key, value in sorted_dict.items():
        if isinstance(value, dict):
            # Sort the sub-keys
            sorted_dict[key] = OrderedDict(sorted(value.items(), key=lambda x: x[0]))
    return sorted_dict


sorted_parsed_index = sort_dict(parsed_index)

with open('map_tr.json', 'w', encoding='utf-8') as f:
    json.dump(sorted_parsed_index, f, indent=4, ensure_ascii=False)
