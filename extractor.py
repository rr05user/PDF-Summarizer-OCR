# extractor.py
import os, io, tempfile
from pdf2image import convert_from_path
from google.cloud import vision
from google.oauth2 import service_account

def _build_client():
    key_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not key_path or not os.path.exists(key_path):
        raise RuntimeError(
            f"Missing/invalid GOOGLE_APPLICATION_CREDENTIALS path: {key_path!r}. "
            "Set it to your service-account JSON."
        )
    creds = service_account.Credentials.from_service_account_file(key_path)
    return vision.ImageAnnotatorClient(credentials=creds)

def extract_text_from_pdf(file_path: str) -> str:
    client = _build_client()

    text_parts = []
    # Render all PDF pages to images (300dpi is a good balance)
    with tempfile.TemporaryDirectory() as tmpdir:
        images = convert_from_path(file_path, dpi=300, output_folder=tmpdir)
        for img in images:
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            image = vision.Image(content=buf.getvalue())
            resp = client.document_text_detection(image=image)
            if resp.error.message:
                raise RuntimeError(f"Vision error: {resp.error.message}")
            text_parts.append(resp.full_text_annotation.text or "")
    return "\n\n".join(text_parts).strip()

