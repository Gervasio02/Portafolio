import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type Suspect = { id: number; name: string; role: string; personality: string };
type Clue = {
  id: number;
  title: string;
  detail: string;
  suspect_id: number;
  false_lead?: boolean;
};
type Entry = {
  suspect_id: number;
  question: string;
  answer: string;
  clue_id: number | null;
};
type Game = {
  id: number;
  case: {
    seed: number;
    difficulty: string;
    title: string;
    victim: string;
    scene: string;
    summary: string;
    timeline: string[];
    evidence_links: { clue_id: number; suspect_id: number; relation: string }[];
    suspects: Suspect[];
    clues: Clue[];
  };
  questions: number;
  remaining: number;
  finished: boolean;
  notes: string;
  history: Entry[];
};
type Result = {
  correct: boolean;
  score: number;
  culprit: string;
  motive: string;
  timeline: string[];
  missed_clues: Clue[];
  secrets: { name: string; secret: string }[];
};
type Rank = { player: string; score: number; difficulty: string };
// En producción la API está en el mismo dominio (VITE_API_URL vacío).
const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
function App() {
  const [token, setToken] = useState(
    localStorage.getItem("interrogatorio_token") || "",
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [game, setGame] = useState<Game | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [difficulty, setDifficulty] = useState("facil");
  const [seed, setSeed] = useState("");
  const [suspect, setSuspect] = useState(0);
  const [message, setMessage] = useState("");
  const [clue, setClue] = useState("");
  const [notes, setNotes] = useState("");
  const [noteStatus, setNoteStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ranking, setRanking] = useState<Rank[]>([]);
  const [history, setHistory] = useState<Game[]>([]);
  async function request(path: string, options: RequestInit = {}) {
    const r = await fetch(API + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    if (!r.ok) {
      let detail = "No se pudo completar la solicitud";
      try {
        const data = await r.json();
        if (typeof data.detail === "string") detail = data.detail;
      } catch {
        /* use fallback */
      }
      throw new Error(detail);
    }
    return r;
  }
  async function run(fn: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }
  async function auth(kind: string) {
    await run(async () => {
      const r = await request(`/auth/${kind}`, {
        method: "POST",
        ...(kind !== "guest"
          ? { body: JSON.stringify({ username, password }) }
          : {}),
      });
      const data = await r.json();
      localStorage.setItem("interrogatorio_token", data.token);
      setToken(data.token);
    });
  }
  async function start() {
    await run(async () => {
      const r = await request("/games", {
        method: "POST",
        body: JSON.stringify({ difficulty, seed: seed ? Number(seed) : null }),
      });
      const g: Game = await r.json();
      setGame(g);
      setResult(null);
      setNotes("");
      setNoteStatus("");
      setSuspect(0);
    });
  }
  async function refresh(id: number) {
    const r = await request(`/games/${id}`);
    const g: Game = await r.json();
    setGame(g);
    setNotes(g.notes);
    setNoteStatus("");
  }
  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!game || !message.trim()) return;
    await run(async () => {
      const r = await request(`/games/${game.id}/question`, {
        method: "POST",
        body: JSON.stringify({
          suspect_id: suspect,
          message,
          clue_id: clue === "" ? null : Number(clue),
        }),
      });
      await r.text();
      setMessage("");
      setClue("");
      await refresh(game.id);
    });
  }
  async function accuse() {
    if (!game) return;
    await run(async () => {
      const r = await request(`/games/${game.id}/accuse`, {
        method: "POST",
        body: JSON.stringify({ suspect_id: suspect }),
      });
      setResult(await r.json());
      await refresh(game.id);
    });
  }
  async function saveNotes() {
    if (!game) return;
    await run(async () => {
      await request(`/games/${game.id}/notes`, {
        method: "PUT",
        body: JSON.stringify({ notes }),
      });
      setNoteStatus("Notas guardadas.");
    });
  }
  async function loadHistory() {
    await run(async () => {
      const r = await request("/games");
      setHistory(await r.json());
    });
  }
  async function loadRanking() {
    await run(async () => {
      const r = await request("/ranking");
      setRanking(await r.json());
    });
  }
  return (
    <>
      <header>
        <div className="brand">
          <span className="mark">I.</span>
          <div>
            INTERROGATORIO<small>ARCHIVO DE INVESTIGACIONES</small>
          </div>
        </div>
        <div className="header-right">
          <span>CASO Nº {game?.id.toString().padStart(4, "0") || "—"}</span>
          {token && (
            <button
              className="link"
              onClick={() => {
                localStorage.removeItem("interrogatorio_token");
                setToken("");
                setGame(null);
                setResult(null);
                setHistory([]);
                setRanking([]);
                setNotes("");
                setNoteStatus("");
              }}
            >
              Salir
            </button>
          )}
        </div>
      </header>
      <main>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {!token ? (
          <section className="welcome">
            <div className="eyebrow">UN JUEGO DE DEDUCCIÓN</div>
            <h1>
              La verdad
              <br />
              <em>deja huellas.</em>
            </h1>
            <p>
              Un crimen. Varios sospechosos. Haz las preguntas correctas y
              conecta las pruebas de cada expediente.
            </p>
            <div className="auth">
              <button disabled={busy} onClick={() => auth("guest")}>
                Entrar como invitado <span>→</span>
              </button>
              <div className="divider">O ACCEDE A TU CUENTA</div>
              <input
                aria-label="Usuario"
                placeholder="Usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <input
                aria-label="Contraseña"
                placeholder="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="row">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => auth("login")}
                >
                  Iniciar sesión
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => auth("register")}
                >
                  Crear cuenta
                </button>
              </div>
            </div>
          </section>
        ) : !game ? (
          <section className="start">
            <div className="eyebrow">TU PRÓXIMA INVESTIGACIÓN</div>
            <h1>
              Abre un <em>caso.</em>
            </h1>
            <p>
              Cada detalle cuenta. Examina las pruebas y pon a prueba las
              coartadas.
            </p>
            <div className="setup">
              <label>
                DIFICULTAD
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="facil">Fácil · 3 sospechosos</option>
                  <option value="medio">Medio · 4 sospechosos</option>
                  <option value="dificil">Difícil · 5 sospechosos</option>
                </select>
              </label>
              <label>
                SEED OPCIONAL
                <input
                  type="number"
                  min="0"
                  max="2147483647"
                  placeholder="Aleatoria"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                />
              </label>
              <button disabled={busy} onClick={start}>
                Comenzar investigación →
              </button>
            </div>
            <div className="row">
              <button className="textbutton" onClick={loadHistory}>
                Ver mis partidas
              </button>
              <button className="textbutton" onClick={loadRanking}>
                Ver ranking
              </button>
            </div>
            {history.map((g) => (
              <div className="listitem" key={g.id}>
                Caso #{g.id} · {g.case.difficulty} ·{" "}
                {g.finished ? "Finalizado" : "En curso"}{" "}
                {!g.finished && (
                  <button
                    className="textbutton"
                    onClick={() => {
                      setGame(g);
                      setNotes(g.notes);
                      setNoteStatus("");
                    }}
                  >
                    Continuar →
                  </button>
                )}
              </div>
            ))}
            {ranking.map((r, i) => (
              <div className="listitem" key={i}>
                {i + 1}. {r.player} · {r.score} puntos · {r.difficulty}
              </div>
            ))}
          </section>
        ) : result ? (
          <section className="result">
            <div className="eyebrow">CASO CERRADO</div>
            <h1>
              {result.correct ? "Caso resuelto." : "La verdad salió a la luz."}
            </h1>
            <p>
              El responsable fue <strong>{result.culprit}</strong>.{" "}
              {result.motive}.
            </p>
            <div className="score">
              {result.score}
              <small>PUNTOS</small>
            </div>
            <h2>La línea de tiempo</h2>
            {result.timeline.map((t) => (
              <p className="listitem" key={t}>
                {t}
              </p>
            ))}
            <h2>Secretos revelados</h2>
            {result.secrets.map((s) => (
              <p key={s.name}>
                <strong>{s.name}:</strong> {s.secret}
              </p>
            ))}
            <h2>Pruebas no presentadas</h2>
            {result.missed_clues.length ? (
              result.missed_clues.map((c) => (
                <p key={c.id}>
                  {c.title}: {c.detail}
                </p>
              ))
            ) : (
              <p>Presentaste todas las pruebas.</p>
            )}
            <button
              onClick={() => {
                setGame(null);
                setResult(null);
              }}
            >
              Abrir otro caso →
            </button>
          </section>
        ) : (
          <>
            <div className="casehead">
              <div>
                <div className="eyebrow">
                  EXPEDIENTE / {game.case.difficulty.toUpperCase()} / SEMILLA{" "}
                  {game.case.seed}
                </div>
                <h1>
                  {game.case.title}
                  <em>.</em>
                </h1>
                <p>
                  {game.case.summary} Escena: {game.case.scene}. Examina las
                  pruebas y encuentra al responsable.
                </p>
              </div>
              <div className="counter">
                <strong>{game.remaining}</strong>
                <span>
                  PREGUNTAS
                  <br />
                  DISPONIBLES
                </span>
              </div>
            </div>
            <div className="layout">
              <aside>
                <div className="section-title">
                  <span>01</span> SOSPECHOSOS
                </div>
                {game.case.suspects.map((s, i) => (
                  <button
                    key={s.id}
                    className={`person ${suspect === s.id ? "active" : ""}`}
                    onClick={() => setSuspect(s.id)}
                  >
                    <span className="avatar">
                      {s.name
                        .split(" ")
                        .map((x) => x[0])
                        .join("")}
                    </span>
                    <span>
                      <strong>{s.name}</strong>
                      <small>
                        {s.role} · {s.personality}
                      </small>
                    </span>
                    <b>{String(i + 1).padStart(2, "0")}</b>
                  </button>
                ))}
                <div className="aside-note">
                  SELECCIONA UN SOSPECHOSO PARA COMENZAR EL INTERROGATORIO
                </div>
              </aside>
              <section className="interview">
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">SALA DE INTERROGATORIO</div>
                    <h2>
                      {game.case.suspects.find((s) => s.id === suspect)?.name}
                    </h2>
                  </div>
                  <span className="live">● EN SESIÓN</span>
                </div>
                <div className="messages">
                  {game.history.filter((h) => h.suspect_id === suspect)
                    .length === 0 && (
                    <div className="empty">
                      ✳<p>La sala está en silencio.</p>
                      <small>
                        Haz una pregunta para iniciar la conversación.
                      </small>
                    </div>
                  )}
                  {game.history
                    .filter((h) => h.suspect_id === suspect)
                    .map((h, i) => (
                      <div key={i}>
                        <div className="bubble question">
                          <small>DETECTIVE</small>
                          {h.question}
                        </div>
                        <div className="bubble answer">
                          <small>TESTIMONIO</small>
                          {h.answer}
                        </div>
                      </div>
                    ))}
                </div>
                <form onSubmit={ask}>
                  <select
                    aria-label="Presentar prueba"
                    value={clue}
                    onChange={(e) => setClue(e.target.value)}
                  >
                    <option value="">Sin presentar prueba</option>
                    {game.case.clues.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                  <div className="compose">
                    <input
                      aria-label="Pregunta"
                      placeholder="Escribe tu pregunta..."
                      value={message}
                      maxLength={500}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                    <button disabled={busy || game.remaining === 0}>
                      Enviar ↑
                    </button>
                  </div>
                </form>
                <button className="accuse" disabled={busy} onClick={accuse}>
                  Acusar a{" "}
                  {game.case.suspects.find((s) => s.id === suspect)?.name} →
                </button>
              </section>
              <aside className="notebook">
                <div className="section-title">
                  <span>02</span> CUADERNO DEL DETECTIVE
                </div>
                <p className="subtle">PRUEBAS ENCONTRADAS</p>
                {game.case.clues.map((c, i) => (
                  <div className="clue" key={c.id}>
                    <span>0{i + 1}</span>
                    <div>
                      <strong>{c.title}</strong>
                      <p>{c.detail}</p>
                    </div>
                  </div>
                ))}
                <details className="case-connections">
                  <summary>Línea temporal</summary>
                  <ol>
                    {game.case.timeline.map((event) => (
                      <li key={event}>{event}</li>
                    ))}
                  </ol>
                </details>
                <details className="case-connections">
                  <summary>Conexiones y contradicciones</summary>
                  <ul>
                    {game.case.evidence_links.map((link) => {
                      const evidence = game.case.clues.find(
                        (item) => item.id === link.clue_id,
                      );
                      const person = game.case.suspects.find(
                        (item) => item.id === link.suspect_id,
                      );
                      return (
                        <li key={`${link.clue_id}-${link.suspect_id}`}>
                          <strong>{evidence?.title}</strong> {link.relation} de{" "}
                          {person?.name}.
                        </li>
                      );
                    })}
                  </ul>
                </details>
                <label className="subtle" htmlFor="notes">
                  TUS ANOTACIONES
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  maxLength={4000}
                  placeholder="Escribe aquí tus deducciones..."
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setNoteStatus("");
                  }}
                />
                <button
                  className="textbutton"
                  disabled={busy}
                  onClick={saveNotes}
                >
                  Guardar notas →
                </button>
                <p role="status" className="subtle">
                  {noteStatus}
                </p>
              </aside>
            </div>
          </>
        )}
      </main>
      <footer>
        <span>INTERROGATORIO © ARCHIVO ÓNIX</span>
        <span>LA VERDAD ESTÁ EN LOS DETALLES.</span>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
