from __future__ import annotations
import json, os, secrets, time, warnings
from datetime import datetime, timedelta, timezone
from typing import Any
import jwt
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from pwdlib import PasswordHash
from sqlalchemy import JSON, Boolean, Integer, String, create_engine, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker, Session
from .engine import Difficulty, answer, generate_case, public_case

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./interrogatorio.db")
def signing_secret() -> str:
    secret = os.getenv("JWT_SECRET", "").strip()
    if secret and secret != "solo-desarrollo-cambiar-antes-de-desplegar" and len(secret) >= 32:
        return secret
    if os.getenv("APP_ENV", "development").lower() == "production":
        raise RuntimeError("JWT_SECRET debe tener al menos 32 caracteres y no ser la clave de ejemplo")
    warnings.warn("JWT_SECRET no configurado de forma segura: las sesiones se perderán al reiniciar", RuntimeWarning)
    return secrets.token_urlsafe(32)

SECRET = signing_secret()
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(engine, expire_on_commit=False)
class Base(DeclarativeBase): pass
class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
class Game(Base):
    __tablename__ = "games"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner: Mapped[str] = mapped_column(String(80), index=True)
    seed: Mapped[int] = mapped_column(Integer)
    difficulty: Mapped[str] = mapped_column(String(10))
    questions: Mapped[int] = mapped_column(default=0)
    finished: Mapped[bool] = mapped_column(Boolean, default=False)
    score: Mapped[int | None] = mapped_column(nullable=True)
    notes: Mapped[str] = mapped_column(String(4000), default="")
    history: Mapped[list] = mapped_column(JSON, default=list)
    presented: Mapped[list] = mapped_column(JSON, default=list)
Base.metadata.create_all(engine)
app = FastAPI(title="Interrogatorio API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","), allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
hasher = PasswordHash.recommended()
def db():
    with SessionLocal() as s: yield s

def identity(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "): raise HTTPException(401, "Inicia sesión o entra como invitado")
    try: return str(jwt.decode(authorization[7:], SECRET, algorithms=["HS256"])["sub"])
    except (jwt.InvalidTokenError, KeyError): raise HTTPException(401, "Sesión inválida")
def token(subject: str) -> str: return jwt.encode({"sub":subject,"exp":datetime.now(timezone.utc)+timedelta(hours=12)}, SECRET, algorithm="HS256")
class Credentials(BaseModel):
    username: str = Field(min_length=3,max_length=40,pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=8,max_length=128)
class NewGame(BaseModel):
    difficulty: Difficulty = "facil"
    seed: int | None = Field(default=None,ge=0,le=2147483647)
class Question(BaseModel):
    suspect_id: int
    message: str = Field(min_length=1,max_length=500)
    clue_id: int | None = None
class Accusation(BaseModel): suspect_id: int
class Notes(BaseModel): notes: str = Field(max_length=4000)

def owned(game_id: int, who: str, session: Session) -> Game:
    g = session.get(Game, game_id)
    if not g or g.owner != who: raise HTTPException(404, "Partida no encontrada")
    return g
def state(g: Game) -> dict[str, Any]:
    return {"id":g.id,"case":public_case(generate_case(g.seed, g.difficulty)),"questions":g.questions,"remaining":25-g.questions,"finished":g.finished,"score":g.score,"notes":g.notes,"history":g.history,"presented":g.presented}
@app.get("/health")
def health(): return {"status":"ok"}
@app.get("/ready")
def readiness():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(503, "Base de datos no disponible")
    return {"status": "ok"}
@app.post("/auth/register")
def register(data: Credentials, session: Session = Depends(db)):
    if session.scalar(select(User).where(User.username == data.username)): raise HTTPException(409,"Nombre ya utilizado")
    session.add(User(username=data.username,password_hash=hasher.hash(data.password))); session.commit()
    return {"token":token("user:"+data.username)}
@app.post("/auth/login")
def login(data: Credentials, session: Session = Depends(db)):
    user = session.scalar(select(User).where(User.username == data.username))
    if not user or not hasher.verify(data.password,user.password_hash): raise HTTPException(401,"Credenciales incorrectas")
    return {"token":token("user:"+user.username)}
@app.post("/auth/guest")
def guest(): return {"token":token("guest:"+secrets.token_hex(16))}
@app.post("/games")
def create_game(data: NewGame, who: str = Depends(identity), session: Session = Depends(db)):
    g=Game(owner=who,seed=data.seed if data.seed is not None else secrets.randbelow(2147483647),difficulty=data.difficulty,history=[],presented=[],notes="")
    session.add(g); session.commit(); return state(g)
@app.get("/games")
def games(who: str = Depends(identity), session: Session = Depends(db)):
    return [state(g) for g in session.scalars(select(Game).where(Game.owner==who).order_by(Game.id.desc())).all()]
@app.get("/games/{game_id}")
def get_game(game_id: int, who: str = Depends(identity), session: Session = Depends(db)): return state(owned(game_id,who,session))
@app.put("/games/{game_id}/notes")
def save_notes(game_id: int, data: Notes, who: str = Depends(identity), session: Session = Depends(db)):
    g=owned(game_id,who,session); g.notes=data.notes; session.commit(); return state(g)
@app.post("/games/{game_id}/question")
def question(game_id: int, data: Question, who: str = Depends(identity), session: Session = Depends(db)):
    g=owned(game_id,who,session)
    if g.finished or g.questions >= 25: raise HTTPException(400,"La partida terminó o no quedan preguntas")
    case=generate_case(g.seed,g.difficulty)
    if data.suspect_id not in [s.id for s in case.suspects]: raise HTTPException(404,"Sospechoso inexistente")
    if data.clue_id is not None and data.clue_id not in [c.id for c in case.clues]: raise HTTPException(400,"Pista inexistente")
    presented=list(g.presented)
    if data.clue_id is not None and data.clue_id not in presented: presented.append(data.clue_id)
    response=answer(case,data.suspect_id,data.message,presented)
    g.presented=presented; g.questions+=1; g.history=[*g.history,{"suspect_id":data.suspect_id,"question":data.message,"answer":response,"clue_id":data.clue_id}]; session.commit()
    def events():
        yield "data: " + json.dumps({"text":response},ensure_ascii=False) + "\n\n"
        yield "data: " + json.dumps({"done":True,"remaining":25-g.questions}) + "\n\n"
    return StreamingResponse(events(),media_type="text/event-stream",headers={"Cache-Control":"no-cache"})
@app.post("/games/{game_id}/accuse")
def accuse(game_id: int, data: Accusation, who: str = Depends(identity), session: Session = Depends(db)):
    g=owned(game_id,who,session); case=generate_case(g.seed,g.difficulty)
    if g.finished: raise HTTPException(400,"La partida ya terminó")
    if data.suspect_id not in [s.id for s in case.suspects]: raise HTTPException(400,"Sospechoso inexistente")
    correct=data.suspect_id==case.culprit_id; g.finished=True; g.score=max(0,100-g.questions*2) if correct else 0; session.commit()
    return {"correct":correct,"score":g.score,"culprit":case.suspects[case.culprit_id].name,"motive":case.motive,"timeline":case.timeline,"missed_clues":[c.model_dump() for c in case.clues if c.id not in g.presented],"secrets":[{"name":s.name,"secret":s.secret} for s in case.suspects]}
@app.get("/ranking")
def ranking(session: Session = Depends(db)):
    rows=session.scalars(select(Game).where(Game.finished==True,Game.owner.like("user:%")).order_by(Game.score.desc()).limit(20)).all()
    return [{"player":g.owner[5:],"score":g.score,"difficulty":g.difficulty} for g in rows]
