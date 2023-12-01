import json
import re


def structure_quran_pages(file_path, start_page, end_page):
    # Load the JSON file
    with open(file_path, 'r', encoding='utf-8') as file:
        quran_pages = json.load(file)

    structured_data = {}

    # Iterate over each page within the specified range and process the verses, titlesRecorder, and footnotes
    for page in quran_pages:
        page_number = page['page']
        if start_page <= page_number <= end_page:
            # print(f"Page {page_number}:")

            lines = page['text'].split("\n")
            verses = []
            versesData = {}
            titlesRecorder = []
            titles = {}
            notes = []
            sura = []

            pageInfo = []
            recording_verseData = False

            title_no = ""

            reading_state = 'page'
            for line in lines:
                line = line.strip()
                if line != "":
                    if reading_state == 'page':
                        if recording_verseData:
                            reading_state = 'verse'
                        else:
                            reading_state = 'title'
                            if re.match(r"^\d+", line):
                                reading_state = 'page'

                    if line.startswith("*"):
                        reading_state = 'notes'
                    elif reading_state != 'notes':
                        if verses:
                            if verses[-1].endswith(".") or verses[-1].endswith(";") or verses[-1].endswith("”"):
                                reading_state = 'title'

                        if not line.endswith((".")):
                            if reading_state != 'verse' and reading_state != 'notes' and reading_state != 'sura' and reading_state != 'title':
                                reading_state = 'title'
                            if re.match(r"^\d+\.", line):
                                if reading_state == 'title':
                                    title_no = line.split(".")[0]
                                    for title in titlesRecorder:
                                        if title_no not in titles:
                                            titles[title_no] = ""
                                        titles[title_no] += title + " "
                                    titlesRecorder = []
                                reading_state = 'verse'
                            if re.match("Sura \d+:", line):
                                reading_state = 'sura'
                        else:
                            if titlesRecorder != [] and titlesRecorder[-1][-1] != "-":
                                reading_state = 'verse'
                        if re.search(r"\d+:\d+-\d+", line):
                            if reading_state == 'verse':
                                recording_verseData = True
                            reading_state = 'page'
                    if re.match(r"^\d+$", line) and reading_state != 'notes':
                        reading_state = 'page'

                    if reading_state == 'title':
                        titlesRecorder.append(line)
                    elif reading_state == 'verse':
                        verses.append(line)
                    elif reading_state == 'notes':
                        notes.append(line)
                    elif reading_state == 'sura':
                        sura.append(line)
                    else:
                        pageInfo.append(line)

                   # print(page_number,reading_state, line)

            verse_no = "0"
            for verse in verses:
                if re.match(r"^\d+\.", verse):
                    verse_no = verse.split(".")[0].strip()
                    versesData[verse_no] = verse.split(".")[1].strip()
                else:
                    if verse_no == "0":
                        versesData[verse_no] = verse
                    else:
                        if versesData[verse_no].strip() != "" and versesData[verse_no][-1] == "-":   
                            versesData[verse_no] = versesData[verse_no][0:-1] + verse
                        else:
                            versesData[verse_no] = versesData[verse_no] + " " + verse
            if len(notes) == 0:
                notes = pageInfo

            structured_data[page_number] = {
                "page": [pageInfo[0], pageInfo[0].split(" ")[-1]] if page_number == 24 else pageInfo,
                "sura": sura,
                "verses": versesData,
                "titles": titles,
                "notes": {
                    "data": notes[0:-4] if page_number == 24 else notes[0:-2],
                    "cumulativefrequencyofthewordGOD": notes[-3] if (page_number == 24 and notes[-3]) else notes[-2],
                    "cumulativesumofverseswhereGODwordoccurs": notes[-1]
                }
            }

    return structured_data


# Usage
file_path = 'quraninpages.json'  # Path to your JSON file
start_page = 24
end_page =  float('inf')  # Set to a very large number to include all pages

structured_quran = structure_quran_pages(file_path, start_page, end_page)

# Save the structured data to a JSON file
with open('structured_quran.json', 'w', encoding='utf-8') as outfile:
    json.dump(structured_quran, outfile, ensure_ascii=False, indent=4)
