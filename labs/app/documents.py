"""Deterministic extraction of labelled fictitious invoices. No AI or OCR."""
import re
from datetime import date

LABELS = {"proveedor": "supplier", "rut": "rut", "folio": "folio", "fecha": "date", "neto": "net", "impuesto": "tax", "iva": "tax", "total": "total"}


def valid_rut(value: str) -> bool:
    normalized = value.replace(".", "").replace("-", "").upper()
    if not re.fullmatch(r"\d{7,8}[\dK]", normalized):
        return False
    total = sum(int(digit) * (2 + index % 6) for index, digit in enumerate(reversed(normalized[:-1])))
    expected = 11 - total % 11
    return normalized[-1] == ("K" if expected == 10 else "0" if expected == 11 else str(expected))


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
            fields[name] = amount(value) if name in ("net", "tax", "total") else value or None
    if fields["rut"]:
        fields["rut"] = normalize_rut(fields["rut"])
    return fields


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
        if value is not None and (type(value) is not int or value < 0 or value > 10**12):
            issues.append(f"Monto CLP inválido: {field}")
    if all(type(fields.get(key)) is int for key in ("net", "tax", "total")):
        if fields["net"] + fields["tax"] != fields["total"]:
            issues.append("Neto más impuesto no coincide con total")
        if fields["tax"] != round(fields["net"] * 19 / 100):
            issues.append("Impuesto distinto de IVA 19%; requiere corregir o rechazar este ejemplo")
    return issues
