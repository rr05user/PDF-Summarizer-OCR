from google.cloud import vision
from pdf2image import convert_from_path
import tempfile
import os

def extract_text_from_pdf(file_path):
    client = vision.ImageAnnotatorClient()

    text = ""

    # Convert PDF to image(s)
    with tempfile.TemporaryDirectory() as path:
        images = convert_from_path(file_path, dpi=300, output_folder=path)

        for image in images:
            with tempfile.NamedTemporaryFile(suffix=".png") as temp_image_file:
                image.save(temp_image_file.name)

                with open(temp_image_file.name, 'rb') as img_file:
                    content = img_file.read()

                image_obj = vision.Image(content=content)
                response = client.document_text_detection(image=image_obj)

                if response.error.message:
                    raise Exception(response.error.message)

                text += response.full_text_annotation.text + "\n"

    return text
