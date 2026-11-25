"""Deterministic case truth and disclosure rules. No model can alter this state."""

from __future__ import annotations
import random
from typing import Literal
from pydantic import BaseModel

Difficulty = Literal["facil", "medio", "dificil"]


class Suspect(BaseModel):
    id: int
    name: str
    role: str
    personality: str
    alibi: str
    secret: str


class Clue(BaseModel):
    id: int
    title: str
    detail: str
    suspect_id: int
    false_lead: bool = False


class EvidenceLink(BaseModel):
    clue_id: int
    suspect_id: int
    relation: str


class Case(BaseModel):
    seed: int
    difficulty: Difficulty
    title: str
    victim: str
    scene: str
    summary: str
    motive: str
    culprit_id: int
    suspects: list[Suspect]
    clues: list[Clue]
    timeline: list[str]
    evidence_links: list[EvidenceLink]


NAMES = [
    ("Elena Rojas", "administradora", "serena"),
    ("Tomás Vidal", "abogado", "arrogante"),
    ("Clara Fuentes", "periodista", "nerviosa"),
    ("Bruno Leiva", "chef", "evasivo"),
    ("Inés Silva", "restauradora", "colaboradora"),
]

CASES = [
    {
        "title": "El silencio del Ónix",
        "victim": "Adrián Valdés",
        "scene": "Biblioteca del Hotel Ónix",
        "summary": "Un auditor aparece sin vida mientras investigaba las cuentas del hotel.",
        "motive": "Ocultar un desfalco descubierto por la víctima",
        "object": "informe financiero",
    },
    {
        "title": "La última restauración",
        "victim": "Amalia Correa",
        "scene": "Galería privada del Hotel Ónix",
        "summary": "Una conservadora muere horas antes de revelar la sustitución de una obra.",
        "motive": "Impedir que se descubriera la venta de una falsificación",
        "object": "registro de autenticidad",
    },
    {
        "title": "La habitación 317",
        "victim": "Nicolás Ferrer",
        "scene": "Archivo de la habitación 317",
        "summary": "Un huésped encuentra documentos que comprometen una red de sobornos.",
        "motive": "Recuperar documentos que demostraban pagos ilícitos",
        "object": "libro de transferencias",
    },
]


def generate_case(seed: int, difficulty: Difficulty) -> Case:
    rng = random.Random(seed)
    theme = CASES[seed % len(CASES)]
    count = {"facil": 3, "medio": 4, "dificil": 5}[difficulty]
    culprit = rng.randrange(count)
    suspects = [
        Suspect(
            id=i,
            name=n,
            role=r,
            personality=p,
            alibi=(
                "Estuve cerca de la biblioteca, pero nadie puede confirmarlo."
                if i == culprit
                else "A las 22:00 estaba en el salón con varios testigos."
            ),
            secret=(
                "Tomé documentos financieros del despacho."
                if i == culprit
                else "Oculté una discusión privada que no tiene relación con el crimen."
            ),
        )
        for i, (n, r, p) in enumerate(NAMES[:count])
    ]
    clues = [
        Clue(
            id=0,
            title="Registro de acceso",
            detail=f"La tarjeta de {suspects[culprit].name} abrió el lugar a las 22:00.",
            suspect_id=culprit,
        ),
        Clue(
            id=1,
            title="Documento roto",
            detail=f"El {theme['object']} vincula a {suspects[culprit].name} con el motivo.",
            suspect_id=culprit,
        ),
        Clue(
            id=2,
            title="Fibra en la escena",
            detail=f"La fibra coincide con la ropa de {suspects[culprit].name}.",
            suspect_id=culprit,
        ),
    ]
    if difficulty == "dificil":
        innocent = (culprit + 1) % count
        clues.append(
            Clue(
                id=3,
                title="Vaso ajeno",
                detail=f"Hay un vaso de {suspects[innocent].name}, dejado durante una visita anterior.",
                suspect_id=innocent,
                false_lead=True,
            )
        )
    links = [
        EvidenceLink(
            clue_id=clue.id,
            suspect_id=clue.suspect_id,
            relation="indicio alternativo"
            if clue.false_lead
            else "contradice su coartada",
        )
        for clue in clues
    ]
    case = Case(
        seed=seed,
        difficulty=difficulty,
        title=theme["title"],
        victim=theme["victim"],
        scene=theme["scene"],
        summary=theme["summary"],
        motive=theme["motive"],
        culprit_id=culprit,
        suspects=suspects,
        clues=clues,
        timeline=[
            "21:40 — La víctima revisa el expediente.",
            f"22:00 — Una tarjeta abre {theme['scene'].lower()}.",
            "22:10 — Se descubre el cuerpo.",
        ],
        evidence_links=links,
    )
    validate_case(case)
    return case


def validate_case(case: Case) -> None:
    ids = {s.id for s in case.suspects}
    if case.culprit_id not in ids or len(ids) != len(case.suspects):
        raise ValueError("Sospechosos inválidos")
    if (
        len(
            [
                c
                for c in case.clues
                if c.suspect_id == case.culprit_id and not c.false_lead
            ]
        )
        < 3
    ):
        raise ValueError("Faltan pistas")
    if any(c.suspect_id not in ids for c in case.clues):
        raise ValueError("Pista inválida")
    if "nadie puede confirmarlo" not in case.suspects[case.culprit_id].alibi:
        raise ValueError("Coartada verificable")
    if any("testigos" not in s.alibi for s in case.suspects if s.id != case.culprit_id):
        raise ValueError("Inocente no exculpable")


def public_case(case: Case) -> dict:
    return {
        "seed": case.seed,
        "difficulty": case.difficulty,
        "title": case.title,
        "victim": case.victim,
        "scene": case.scene,
        "summary": case.summary,
        "timeline": case.timeline,
        "suspects": [
            {"id": s.id, "name": s.name, "role": s.role, "personality": s.personality}
            for s in case.suspects
        ],
        "clues": [c.model_dump() for c in case.clues],
        "evidence_links": [link.model_dump() for link in case.evidence_links],
    }


def answer(case: Case, suspect_id: int, message: str, presented: list[int]) -> str:
    s = next((x for x in case.suspects if x.id == suspect_id), None)
    if s is None:
        raise ValueError("Sospechoso inexistente")
    pressure = len(
        {
            c.id
            for c in case.clues
            if c.id in presented and c.suspect_id == suspect_id and not c.false_lead
        }
    )
    lower = message.casefold()
    if any(
        w in lower
        for w in (
            "ignora",
            "instrucciones",
            "sistema",
            "prompt",
            "culpable",
            "confiesa",
            "contraseña",
            "secreto",
        )
    ):
        return "No voy a especular. Pregúnteme por mis movimientos o por una prueba."
    if pressure >= 2:
        return f"{s.alibi} Hay algo más: {s.secret}"
    if pressure == 1:
        return f"Esa prueba merece una explicación. {s.alibi}"
    if any(w in lower for w in ("nombre", "quién eres", "ocupación", "trabajo")):
        return f"Soy {s.name}, {s.role} del hotel."
    return s.alibi
