"""
Document Processor — pluggable OCR + extraction pipeline.
Layer 1: OCR (Tesseract or raw text for non-image files)
Layer 2: Extraction (regex-based or Claude API)
"""
import re
import os
import io
from typing import List, Dict, Optional


class ExtractionResult:
    def __init__(self):
        self.serials: List[Dict] = []  # [{serial_number, product_code}]
        self.shipment_reference: Optional[str] = None
        self.errors: List[str] = []
        self.raw_text: str = ""
        self.provider_used: str = ""


def extract_text_from_file(file_path: str, content_type: str) -> str:
    """Layer 1: Extract raw text from uploaded file."""
    ext = os.path.splitext(file_path)[1].lower()

    if ext in ('.txt', '.csv'):
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            return f.read()

    if ext in ('.png', '.jpg', '.jpeg', '.tiff', '.bmp'):
        try:
            import pytesseract
            from PIL import Image
            img = Image.open(file_path)
            return pytesseract.image_to_string(img)
        except ImportError:
            return f"[OCR not available — install pytesseract and Tesseract OCR. File: {file_path}]"

    if ext == '.pdf':
        try:
            import pytesseract
            from PIL import Image
            from pdf2image import convert_from_path
            images = convert_from_path(file_path)
            texts = [pytesseract.image_to_string(img) for img in images]
            return "\n".join(texts)
        except ImportError:
            try:
                import fitz  # PyMuPDF
                doc = fitz.open(file_path)
                texts = [page.get_text() for page in doc]
                return "\n".join(texts)
            except ImportError:
                return f"[PDF text extraction not available — install PyMuPDF or pytesseract+pdf2image]"

    if ext in ('.xls', '.xlsx'):
        try:
            import openpyxl
            wb = openpyxl.load_workbook(file_path)
            texts = []
            for ws in wb.worksheets:
                for row in ws.iter_rows(values_only=True):
                    texts.append(",".join(str(cell) if cell is not None else "" for cell in row))
            return "\n".join(texts)
        except ImportError:
            return f"[Excel reading not available — install openpyxl]"

    return f"[Unsupported file type: {ext}]"


def regex_extract(raw_text: str) -> ExtractionResult:
    """Layer 2 — Regex-based extraction. Looks for serial number patterns."""
    result = ExtractionResult()
    result.raw_text = raw_text
    result.provider_used = "regex"

    lines = raw_text.strip().split('\n')

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Skip header lines regardless of format
        first_token = line.split()[0].lower() if line.split() else ''
        if first_token in ('serial', 'serial_number', 'sn', '#', 'number'):
            continue

        # Pattern 1: CSV format — SERIAL_NUMBER,PRODUCT_CODE
        if ',' in line:
            parts = [p.strip() for p in line.split(',')]
            if len(parts) >= 2 and len(parts[0]) >= 3:
                result.serials.append({
                    "serial_number": parts[0],
                    "product_code": parts[1],
                })
                continue

        # Pattern 2: Tab-separated
        if '\t' in line:
            parts = [p.strip() for p in line.split('\t')]
            if len(parts) >= 2 and len(parts[0]) >= 3:
                result.serials.append({
                    "serial_number": parts[0],
                    "product_code": parts[1],
                })
                continue

        # Pattern 3: Space-separated — exactly two tokens (SERIAL PRODUCT_CODE)
        parts_space = line.split()
        if len(parts_space) == 2 and len(parts_space[0]) >= 3:
            result.serials.append({
                "serial_number": parts_space[0],
                "product_code": parts_space[1],
            })
            continue

        # Pattern 4: Serial number on its own line (alphanumeric, min 5 chars)
        sn_match = re.match(r'^([A-Za-z0-9\-_]{5,30})$', line)
        if sn_match:
            result.serials.append({
                "serial_number": sn_match.group(1),
                "product_code": "",  # unknown — user must fill in
            })

    # Try to find shipment reference
    for line in lines:
        ref_match = re.search(r'(?:shipment|ship|ref|reference)[:\s#]*([A-Za-z0-9\-_]+)', line, re.IGNORECASE)
        if ref_match:
            result.shipment_reference = ref_match.group(1)
            break

    if not result.serials:
        result.errors.append("No serial numbers detected. Supported formats: CSV (SERIAL,PRODUCT_CODE), tab-separated, or one serial per line.")

    return result


def claude_api_extract(raw_text: str, api_key: str) -> ExtractionResult:
    """Layer 2 — Claude API extraction. Sends text to Claude for intelligent parsing."""
    result = ExtractionResult()
    result.raw_text = raw_text
    result.provider_used = "claude_api"

    if not api_key or api_key == "***":
        result.errors.append("Claude API key not configured. Go to Admin → System Config to set ANTHROPIC_API_KEY.")
        return result

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": f"""Extract serial numbers and product codes from this document text.
Return ONLY a JSON array of objects with "serial_number" and "product_code" fields.
If you can identify a shipment reference, add it as a "shipment_reference" field on the first object.
If product_code is unclear, use an empty string.

Document text:
{raw_text}

Response (JSON array only, no markdown):"""
            }]
        )

        import json
        text = response.content[0].text.strip()
        # Strip markdown code blocks if present
        if text.startswith('```'):
            text = re.sub(r'^```\w*\n?', '', text)
            text = re.sub(r'\n?```$', '', text)

        parsed = json.loads(text)
        if isinstance(parsed, list):
            for item in parsed:
                sn = item.get("serial_number", "").strip()
                pc = item.get("product_code", "").strip()
                if sn:
                    result.serials.append({"serial_number": sn, "product_code": pc})
            if parsed and parsed[0].get("shipment_reference"):
                result.shipment_reference = parsed[0]["shipment_reference"]
    except ImportError:
        result.errors.append("anthropic package not installed. Run: pip install anthropic")
    except Exception as e:
        result.errors.append(f"Claude API error: {str(e)}")

    return result


def process_document(file_path: str, content_type: str, provider: str = "regex", api_key: str = None) -> ExtractionResult:
    """Main entry point: OCR + extraction."""
    raw_text = extract_text_from_file(file_path, content_type)

    if provider == "claude_api":
        return claude_api_extract(raw_text, api_key)
    else:
        return regex_extract(raw_text)
