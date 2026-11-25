"""Deterministic invoice extraction with bounded local PDF/OCR adapters."""

import io
import re
from datetime import date
from pathlib import Path

MAX_DOCUMENT_BYTES = 5 * 1024 * 1024

LABELS = {
    "proveedor": "supplier",
    "rut": "rut",
    "folio": "folio",
    "fecha": "date",
    "neto": "net",
    "impuesto": "tax",
    "iva": "tax",
    "total": "total",
}


def valid_rut(value: str) -> bool:
    normalized = value.replace(".", "").replace("-", "").upper()
    if not re.fullmatch(r"\d{7,8}[\dK]", normalized):
        return False
    total = sum(
        int(digit) * (2 + index % 6)
        for index, digit in enumerate(reversed(normalized[:-1]))
    )
    expected = 11 - total % 11
    return normalized[-1] == (
        "K" if expected == 10 else "0" if expected == 11 else str(expected)
    )


def normalize_rut(value: str) -> str:
    clean = value.replace(".", "").replace("-", "").upper().strip()
    return clean[:-1] + "-" + clean[-1:] if clean else ""


def amount(value: str) -> int | None:
    # CLP only: reject ambiguous decimals, negatives and currency mixtures.
    value = value.strip().replace("$", "").replace("CLP", "").strip()
    if re.fullmatch(r"\d{1,3}(\.\d{3})+|\d+", value):
        number = int(value.replace(".", ""))
        return number if number <= 10**12 else None
    return None


def extract(source: str) -> dict:
    fields = dict.fromkeys(LABELS.values())
    for line in source.splitlines():
        match = re.match(r"^\s*([\wáéíóú]+)\s*:\s*(.*?)\s*$", line, re.I)
        if match and match.group(1).lower() in LABELS:
            name = LABELS[match.group(1).lower()]
            value = match.group(2).strip()
            fields[name] = (
                amount(value) if name in ("net", "tax", "total") else value or None
            )
    if fields["rut"]:
        fields["rut"] = normalize_rut(fields["rut"])
    return fields


def extract_file(content: bytes, filename: str) -> tuple[str, str]:
    """Return extracted text and a truthful description of the local method used."""
    if not content or len(content) > MAX_DOCUMENT_BYTES:
        raise ValueError("El documento debe contener entre 1 byte y 5 MB")
    extension = Path(filename).suffix.lower()
    if extension == ".txt":
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError as error:
            raise ValueError("El texto debe estar codificado en UTF-8") from error
        method = "texto UTF-8; reglas deterministas"
    elif extension == ".pdf":
        try:
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(content), strict=True)
            if len(reader.pages) > 20:
                raise ValueError("El PDF admite un máximo de 20 páginas")
            if reader.is_encrypted:
                raise ValueError("No se admiten PDF cifrados")
            text = "\n".join((page.extract_text() or "") for page in reader.pages)
        except ValueError:
            raise
        except Exception as error:
            raise ValueError("PDF inválido o no procesable") from error
        method = "texto incrustado en PDF; reglas deterministas"
        if not text.strip():
            raise ValueError(
                "El PDF no contiene texto; utiliza una imagen para OCR local"
            )
    elif extension in (".png", ".jpg", ".jpeg"):
        try:
            from PIL import Image
            import pytesseract

            with Image.open(io.BytesIO(content)) as image:
                if image.width * image.height > 16_000_000:
                    raise ValueError("La imagen supera 16 megapíxeles")
                image.verify()
            with Image.open(io.BytesIO(content)) as image:
                text = pytesseract.image_to_string(
                    image, lang="spa", config="--psm 6", timeout=15
                )
        except ValueError:
            raise
        except Exception as error:
            raise ValueError("OCR local no disponible o imagen inválida") from error
        method = "OCR local Tesseract (spa); reglas deterministas"
        if not text.strip():
            raise ValueError("OCR sin texto reconocible")
    else:
        raise ValueError("Solo se admiten TXT, PDF con texto, PNG y JPG")
    if len(text) > 50_000:
        raise ValueError("El texto extraído supera 50.000 caracteres")
    return text.strip(), method


def validate(fields: dict) -> list[str]:
    issues = []
    for field in ("supplier", "rut", "folio", "date", "net", "tax", "total"):
        if fields.get(field) is None or fields.get(field) == "":
            issues.append(f"Campo ausente o inválido: {field}")
    if fields.get("rut") and not valid_rut(fields["rut"]):
        issues.append("RUT inválido")
    if fields.get("date"):
        try:
            date.fromisoformat(fields["date"])
        except ValueError:
            issues.append("Fecha inválida; utiliza AAAA-MM-DD")
    for field in ("net", "tax", "total"):
        value = fields.get(field)
        if value is not None and (
            type(value) is not int or value < 0 or value > 10**12
        ):
            issues.append(f"Monto CLP inválido: {field}")
    if all(type(fields.get(key)) is int for key in ("net", "tax", "total")):
        if fields["net"] + fields["tax"] != fields["total"]:
            issues.append("Neto más impuesto no coincide con total")
        if fields["tax"] != round(fields["net"] * 19 / 100):
            issues.append(
                "Impuesto distinto de IVA 19%; requiere corregir o rechazar este ejemplo"
            )
    return issues
