from pdfminer.high_level import extract_text
import json

def post_process_text(text):
    # Add mappings for known incorrect encodings here
    replacements = {
        '\u00e3': 'ã',
        # '\\u2019': '’',
        # Add more replacements as needed
    }
    for incorrect, correct in replacements.items():
        text = text.replace(incorrect, correct)
    return text

def extract_page_to_json(pdf_path, page, json_file):
    text = extract_text(pdf_path, page_numbers=[page - 1])
    text = post_process_text(text)
    with open(json_file, 'w') as file:
        json_data = {"page": page, "text": text}
        json.dump(json_data, file, indent=4)

def extract_pages_to_json(pdf_path, pages, json_file):
    texts = [extract_text(pdf_path, page_numbers=[page - 1]) for page in pages]
    texts = [post_process_text(text) for text in texts]
    with open(json_file, 'w') as file:
        json_data = [{"page": page, "text": text} for page, text in zip(pages, texts)]
        json.dump(json_data, file, indent=4)

def extract_pages_inorder_to_json(pdf_path, start_page, end_page, json_file):
    texts = [extract_text(pdf_path, page_numbers=[page]) for page in range(start_page - 1, end_page)]
    texts = [post_process_text(text) for text in texts]
    with open(json_file, 'w') as file:
        json_data = [{"page": page_num, "text": text} for page_num, text in enumerate(texts, start=start_page)]
        json.dump(json_data, file, indent=4)


extract_pages_to_json('../source/quran-english1667577051837.pdf', [5, 6, 7], 'proclaim.json')
extract_page_to_json('../source/quran-english1667577051837.pdf', 3, 'splash.json')
extract_pages_inorder_to_json('../source/quran-english1667577051837.pdf', 13, 21, 'introduction.json')
extract_pages_inorder_to_json('../source/quran-english1667577051837.pdf', 23, 394, 'quraninpages.json')
extract_pages_inorder_to_json('../source/quran-english1667577051837.pdf', 395, 508, 'appendices.json')
extract_pages_inorder_to_json('../source/quran-english1667577051837.pdf', 511, 558, 'index.json')
# extract_pages_to_json('../source/quran-english1667577051837.pdf', [23, 24], 'test.json')
