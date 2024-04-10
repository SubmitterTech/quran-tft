import json


def parse_koran_content(content):
    # Parse content into verses, titles, and footnotes
    verses, titles, footnotes = {}, {}, {}
    lines = content.split('\n')
    current_verse = None
    for line in lines:
        if line.startswith('['):  # It's a verse
            parts = line[1:].split(']')
            verse_key = parts[0]
            verses[verse_key] = parts[1].strip()
            current_verse = verse_key
        elif line.startswith('*'):  # It's a footnote with a key
            footnote_key, footnote_text = line.split(' ', 1)
            footnotes[footnote_key] = footnote_text.strip()
        else:  # It's a title
            if current_verse and line.strip() != "":
                titles[current_verse.split(':')[0] + ':' + str(int(current_verse.split(':')[1])+1)] = line.strip()

    return verses, titles, footnotes


# Load koran.json
with open('koran.json', 'r', encoding='utf-8') as file:
    koran_data = json.load(file)

# Load quran_de.json
with open('../quran_en.json', 'r', encoding='utf-8') as file:
    quran_german_data = json.load(file)


# Iterate through the suras in quran_de.json and update with koran.json content
for page, content in quran_german_data.items():
    for sura_id in content['sura']:
        if sura_id in koran_data:
            koran_verses, koran_titles, koran_footnotes = parse_koran_content(
                koran_data[sura_id])

            # Update verses
            for verse_id in content['sura'][sura_id]['verses']:
                if sura_id+':'+verse_id in koran_verses.keys():
                    content['sura'][sura_id]['verses'][verse_id] = koran_verses[sura_id+':'+verse_id]
            # Update titles
            for title_id in content['sura'][sura_id]['titles']:
                if sura_id+':'+title_id in koran_titles.keys():
                    content['sura'][sura_id]['titles'][title_id] = koran_titles[sura_id+':'+title_id]
            # Update footnotes
            for i, footnote in enumerate(content['notes']['data']):
                note_key = footnote.split(' ')[0]
                if note_key in koran_footnotes:
                    updated_footnote = note_key + ' ' +koran_footnotes[note_key]
                    content['notes']['data'][i] = updated_footnote


# Write updated quran_de.json
with open('quran_de.json', 'w', encoding='utf-8') as outfile:
    json.dump(quran_german_data, outfile, ensure_ascii=False, indent=4)
