import fitz  # PyMuPDF
import json
import os

def pdf_to_json(pdf_folder_path):
    # Initialize a dictionary to hold all PDF texts.
    koran_dict = {}

    # Loop through each PDF file and extract text.
    for i in range(1, 115):  # Assuming there are 114 kapitels
        pdf_path = os.path.join(pdf_folder_path, f'kapitel_{i}.pdf')
        
        # Check if the PDF file exists
        if os.path.exists(pdf_path):
            # Open the PDF file
            doc = fitz.open(pdf_path)
            text = ''
            for page in doc:
                # Extract text from the current page and add a newline after each page's text
                text += page.get_text() + "\n"
            doc.close()
            
            # Add the extracted text to the dictionary with the sura name as the key.
            koran_dict[f'kapitel_{i}'] = text
        else:
            print(f"File {pdf_path} not found.")

    # Convert the dictionary to a JSON string.
    json_data = json.dumps(koran_dict, ensure_ascii=False, indent=4)

    # Define the JSON file name.
    json_file_name = os.path.join(pdf_folder_path, 'koran.json')

    # Write the JSON data to a file.
    with open(json_file_name, 'w', encoding='utf-8') as json_file:
        json_file.write(json_data)

    return json_file_name

pdf_folder_path = 'german'  # Update this to the correct path if needed

# Convert the PDFs to JSON and get the JSON file name
json_file_name = pdf_to_json(pdf_folder_path)

print(f"All PDF content has been written to JSON file: {json_file_name}")
