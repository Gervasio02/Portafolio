"""Bounded, reproducible tabular ingestion without evaluating user content."""

import csv
import io
import math
import zipfile
from collections import Counter
from pathlib import Path

MAX_BYTES = 5 * 1024 * 1024
MAX_ROWS = 10000
MAX_COLUMNS = 64


def ingest(content: bytes, filename: str) -> tuple[list[str], list[list[str]]]:
    if not content or len(content) > MAX_BYTES:
        raise ValueError("El archivo debe contener entre 1 byte y 5 MB")
    extension = Path(filename).suffix.lower()
    if extension == ".csv":
        try:
            source = content.decode("utf-8-sig")
        except UnicodeDecodeError as error:
            raise ValueError("El CSV debe estar codificado en UTF-8") from error
        if "\x00" in source:
            raise ValueError("El CSV contiene caracteres binarios")
        try:
            dialect = csv.Sniffer().sniff(source[:8192], delimiters=",;\t")
        except csv.Error:
            dialect = csv.excel
        try:
            table = list(csv.reader(io.StringIO(source), dialect, strict=True))
        except csv.Error as error:
            raise ValueError("CSV mal formado") from error
    elif extension == ".xlsx":
        from openpyxl import load_workbook

        try:
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                entries = archive.infolist()
                if (
                    len(entries) > 1000
                    or sum(entry.file_size for entry in entries) > 30 * 1024 * 1024
                ):
                    raise ValueError("El Excel expandido supera el límite permitido")
                if any(
                    "vbaproject" in entry.filename.lower()
                    or "externallinks" in entry.filename.lower()
                    for entry in entries
                ):
                    raise ValueError("No se permiten macros ni enlaces externos")
            workbook = load_workbook(
                io.BytesIO(content), read_only=True, data_only=False, keep_links=False
            )
            try:
                sheet = workbook.active
                if sheet.max_row > MAX_ROWS + 1 or sheet.max_column > MAX_COLUMNS:
                    raise ValueError("Máximo 10.000 registros y 64 columnas")
                table = []
                for row in sheet.iter_rows():
                    if any(cell.data_type == "f" for cell in row):
                        raise ValueError(
                            "No se permiten fórmulas en Excel; exporta sus valores"
                        )
                    table.append(
                        ["" if cell.value is None else str(cell.value) for cell in row]
                    )
            finally:
                workbook.close()
        except (zipfile.BadZipFile, KeyError, OSError) as error:
            raise ValueError("Excel inválido") from error
    else:
        raise ValueError("Solo se admiten CSV UTF-8 y XLSX sin fórmulas")
    if not table or not table[0]:
        raise ValueError("Falta la fila de encabezados")
    headers = [str(value).strip() for value in table[0]]
    if not all(headers) or len(set(headers)) != len(headers):
        raise ValueError("Los encabezados deben ser únicos y no estar vacíos")
    if len(headers) > MAX_COLUMNS or len(table) > MAX_ROWS + 1:
        raise ValueError("Máximo 10.000 registros y 64 columnas")
    if any(len(row) != len(headers) for row in table[1:]):
        raise ValueError("Todas las filas deben tener el mismo número de columnas")
    if any(len(str(cell)) > 4000 for row in table for cell in row):
        raise ValueError("Cada celda admite hasta 4.000 caracteres")
    return headers, [[str(cell) for cell in row] for row in table[1:]]


def clean(rows: list[list[str]], drop_incomplete: bool) -> tuple[list[list[str]], dict]:
    normalized = [[cell.strip() for cell in row] for row in rows]
    missing = sum(not cell for row in normalized for cell in row)
    empty_rows = sum(not any(row) for row in normalized)
    seen = set()
    result = []
    duplicates = 0
    incomplete_removed = 0
    for row in normalized:
        if not any(row):
            continue
        key = tuple(row)
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)
        if drop_incomplete and not all(row):
            incomplete_removed += 1
            continue
        result.append(row)
    return result, {
        "input_rows": len(rows),
        "output_rows": len(result),
        "duplicates_removed": duplicates,
        "empty_rows_removed": empty_rows,
        "missing_cells": missing,
        "incomplete_rows_removed": incomplete_removed,
        "policy": {
            "trim": True,
            "deduplicate": True,
            "drop_incomplete": drop_incomplete,
        },
    }


def numeric(value: str) -> float | None:
    try:
        number = float(value)
        return number if math.isfinite(number) and abs(number) <= 1e100 else None
    except (ValueError, TypeError):
        return None


def profile(headers: list[str], rows: list[list[str]]) -> list[dict]:
    result = []
    for index, name in enumerate(headers):
        values = [row[index] for row in rows]
        numbers = [number for value in values if (number := numeric(value)) is not None]
        result.append(
            {
                "name": name,
                "missing": values.count(""),
                "unique": len(set(values)),
                "numeric_count": len(numbers),
                "sum": sum(numbers) if numbers else None,
                "mean": sum(numbers) / len(numbers) if numbers else None,
                "min": min(numbers) if numbers else None,
                "max": max(numbers) if numbers else None,
                "frequencies": [
                    {"value": value, "count": count}
                    for value, count in Counter(values).most_common(10)
                ],
            }
        )
    return result


def export_csv(headers: list[str], rows: list[list[str]]) -> str:
    def safe(value: str) -> str:
        # Spreadsheet programs may interpret these prefixes even in quoted CSV cells.
        return (
            "'" + value
            if value.lstrip().startswith(("=", "+", "-", "@"))
            or value.startswith(("\t", "\r", "\n"))
            else value
        )

    stream = io.StringIO(newline="")
    writer = csv.writer(stream)
    writer.writerow([safe(cell) for cell in headers])
    writer.writerows([[safe(cell) for cell in row] for row in rows])
    return stream.getvalue()
