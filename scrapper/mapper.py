import json
import re
from collections import defaultdict


def parse_index(entries):
    dictionary = defaultdict(lambda: defaultdict(dict))
    current_main_key = ''
    current_sub_key = ''
    current_sub_entries = defaultdict(str)

    for entry in entries:
        entry = entry.strip()

        if len(entry) == 0:
            continue # Ignore empty line
        if re.match(r"index", entry, flags=re.IGNORECASE):
            continue  # Ignore index name at page corner
        if re.match(r"^\d\d\d", entry, flags=re.IGNORECASE):
            if len(entry) == 3 and int(entry) > 488:
                continue  # Ignore page numbers

        if re.match(r'^[A-Z]$', entry):
            if current_main_key and current_sub_entries:
                dictionary[current_main_key].update(current_sub_entries)
                current_sub_entries = defaultdict(str)

            current_main_key = entry
            current_sub_key = ''
        else:
            if entry.startswith(current_main_key) and (not current_sub_key or entry != current_sub_key):
                if current_sub_key:
                    dictionary[current_main_key][current_sub_key] = current_sub_entries[current_sub_key]

                sub_entry_match = re.match(r"([A-Za-z, ]+)(\d.*)", entry)
                
                if sub_entry_match:
                    current_sub_key, current_references = sub_entry_match.groups()
                    current_sub_entries[current_sub_key] = current_references.strip()
                else:
                    split_point = re.search(r'\d', entry)
                    if split_point:
                        index = split_point.start()
                        current_sub_key = entry[:index].strip()
                        current_references = entry[index:].strip()
                        current_sub_entries[current_sub_key] = current_references.strip()
                    else:
                        current_sub_key = entry
                        current_references = ''

            elif current_sub_key:
                if re.search(r"[A-Za-z]", entry):
                    split_point = re.search(r'\d', entry)
                    inner_key = entry
                    if split_point:
                        index = split_point.start()
                        inner_key = entry[:index].strip()
                        value = entry[index:].strip()
                        if isinstance(current_sub_entries[current_sub_key], str):
                            current_sub_entries[current_sub_key] = {inner_key: value}
                        else:
                            current_sub_entries[current_sub_key][inner_key] = value
                    else:
                        if re.search(r"see", entry):
                            print(entry)
                        if isinstance(current_sub_entries[current_sub_key], str):
                            current_sub_entries[current_sub_key] = {entry: ''}
                        else:
                            current_sub_entries[current_sub_key][entry] = ''
                else:
                    if current_sub_entries[current_sub_key]:
                        if isinstance(current_sub_entries[current_sub_key], dict):
                            last_key = list(current_sub_entries[current_sub_key])[-1]
                            if len(current_sub_entries[current_sub_key][last_key]) > 0:
                                if current_sub_entries[current_sub_key][last_key][-1] == ";": 
                                    current_sub_entries[current_sub_key][last_key] += " " + entry
                                elif current_sub_entries[current_sub_key][last_key][-1] == "-":
                                    current_sub_entries[current_sub_key][last_key] += entry
                                else:
                                    current_sub_entries[current_sub_key][last_key] += "; " + entry
                            else:
                                current_sub_entries[current_sub_key][last_key] +=  entry
                        else:
                            if current_sub_entries[current_sub_key][-1] == ";": 
                                current_sub_entries[current_sub_key] += " " + entry
                            elif current_sub_entries[current_sub_key][-1] == "-":
                                current_sub_entries[current_sub_key] += entry
                            elif current_sub_entries[current_sub_key][-1] == ",":
                                current_sub_entries[current_sub_key] += entry
                            else:
                                current_sub_entries[current_sub_key] += "; " + entry

                    else:
                        current_sub_entries[current_sub_key] += entry

    if current_main_key and current_sub_entries:
        dictionary[current_main_key].update(current_sub_entries)

    return {k: dict(v) for k, v in dictionary.items()}

with open('index.json', 'r', encoding='utf-8') as file:
    index_json = json.load(file)

all_entries = []
for page in index_json:
    all_entries.extend(page['text'].split('\n'))
    # if page['page'] == 517:
    #     break

parsed_index = parse_index(all_entries)

with open('map.json', 'w', encoding='utf-8') as f:
    json.dump(parsed_index, f, indent=4, ensure_ascii=False)
