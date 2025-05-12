import os
from core.config import settings
from PyPDF2 import PdfReader
from docx import Document as DocxDocument

def get_document_text(user_id: int, stored_filename: str) -> str:
    path = os.path.join(settings.UPLOAD_DIR, str(user_id), stored_filename)
    ext = os.path.splitext(stored_filename)[1].lower()
    if ext == ".pdf":
        reader = PdfReader(path)
        text = ""
        for page in reader.pages:
            content = page.extract_text() or ""
            text += content + "\n"
        return text
    elif ext == ".docx":
        doc = DocxDocument(path)
        return "\n".join(p.text for p in doc.paragraphs)
    else:
        raise ValueError("Unsupported file type")