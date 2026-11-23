"""Deterministic case truth and disclosure rules. No model can alter this state."""
from __future__ import annotations
import random
from typing import Literal
from pydantic import BaseModel, Field

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

class Case(BaseModel):
    seed: int
    difficulty: Difficulty
    victim: str = "Adrián Valdés"
    scene: str = "Biblioteca del Hotel Ónix"
    motive: str = "Ocultar un desfalco descubierto por la víctima"
    culprit_id: int
    suspects: list[Suspect]
    clues: list[Clue]
    timeline: list[str]

NAMES = [("Elena Rojas", "administradora", "serena"), ("Tomás Vidal", "abogado", "arrogante"), ("Clara Fuentes", "periodista", "nerviosa"), ("Bruno Leiva", "chef", "evasivo"), ("Inés Silva", "restauradora", "colaboradora")]

def generate_case(seed: int, difficulty: Difficulty) -> Case:
    rng = random.Random(seed)
    count = {"facil": 3, "medio": 4, "dificil": 5}[difficulty]
    culprit = rng.randrange(count)
    suspects = [Suspect(id=i, name=n, role=r, personality=p, alibi=("Estuve cerca de la biblioteca, pero nadie puede confirmarlo." if i == culprit else "A las 22:00 estaba en el salón con varios testigos."), secret=("Tomé documentos financieros del despacho." if i == culprit else "Oculté una discusión privada que no tiene relación con el crimen.")) for i, (n,r,p) in enumerate(NAMES[:count])]
    clues = [Clue(id=0,title="Registro de acceso",detail=f"La tarjeta de {suspects[culprit].name} abrió la biblioteca a las 22:00.",suspect_id=culprit), Clue(id=1,title="Documento roto",detail=f"Un informe vincula a {suspects[culprit].name} con el desfalco.",suspect_id=culprit), Clue(id=2,title="Fibra en la escena",detail=f"La fibra coincide con la ropa de {suspects[culprit].name}.",suspect_id=culprit)]
    if difficulty == "dificil":
        innocent = (culprit + 1) % count
        clues.append(Clue(id=3,title="Vaso ajeno",detail=f"Hay un vaso de {suspects[innocent].name}, dejado durante una visita anterior.",suspect_id=innocent,false_lead=True))
    case = Case(seed=seed,difficulty=difficulty,culprit_id=culprit,suspects=suspects,clues=clues,timeline=["21:40 — La víctima revisa las cuentas.", f"22:00 — {suspects[culprit].name} entra en la biblioteca.", "22:10 — Se descubre el cuerpo."])
    validate_case(case)
    return case

def validate_case(case: Case) -> None:
    ids = {s.id for s in case.suspects}
    if case.culprit_id not in ids or len(ids) != len(case.suspects): raise ValueError("Sospechosos inválidos")
    if len([c for c in case.clues if c.suspect_id == case.culprit_id and not c.false_lead]) < 3: raise ValueError("Faltan pistas")
    if any(c.suspect_id not in ids for c in case.clues): raise ValueError("Pista inválida")
    if "nadie puede confirmarlo" not in case.suspects[case.culprit_id].alibi: raise ValueError("Coartada verificable")
    if any("testigos" not in s.alibi for s in case.suspects if s.id != case.culprit_id): raise ValueError("Inocente no exculpable")

def public_case(case: Case) -> dict:
    return {"seed":case.seed,"difficulty":case.difficulty,"victim":case.victim,"scene":case.scene,"suspects":[{"id":s.id,"name":s.name,"role":s.role,"personality":s.personality} for s in case.suspects],"clues":[c.model_dump() for c in case.clues]}

def answer(case: Case, suspect_id: int, message: str, presented: list[int]) -> str:
    s = next((x for x in case.suspects if x.id == suspect_id), None)
    if s is None: raise ValueError("Sospechoso inexistente")
    pressure = len({c.id for c in case.clues if c.id in presented and c.suspect_id == suspect_id and not c.false_lead})
    lower = message.casefold()
    if any(w in lower for w in ("ignora", "instrucciones", "sistema", "prompt", "culpable", "confiesa", "contraseña", "secreto")):
        return "No voy a especular. Pregúnteme por mis movimientos o por una prueba."
    if pressure >= 2:
        return f"{s.alibi} Hay algo más: {s.secret}"
    if pressure == 1: return f"Esa prueba merece una explicación. {s.alibi}"
    if any(w in lower for w in ("nombre", "quién eres", "ocupación", "trabajo")): return f"Soy {s.name}, {s.role} del hotel."
    return s.alibi
