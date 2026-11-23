import { OperationsPanel } from "./OperationsPanel.jsx";
import { useState } from "react";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Layers3,
  ListTodo,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { refreshSeconds, useLiveRefresh } from "./live.js";
import "./control.css";

const columns = [
  ["todo", "Por hacer", "var(--stage-todo)"],
  ["doing", "En progreso", "var(--stage-doing)"],
  ["done", "Hecho", "var(--stage-done)"],
];
const priorities = [
  ["high", "Alta", "var(--urgency-high)"],
  ["medium", "Media", "var(--urgency-medium)"],
  ["low", "Baja", "var(--urgency-low)"],
];
const roles = { OWNER: "Dueño", EDITOR: "Editor", VIEWER: "Lector" };
const formatCount = new Intl.NumberFormat("es-CL");
const displayDay = (date) =>
  new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
const displayTime = (date) =>
  new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(date));

function Metric({ icon: Icon, label, value, hint, tone }) {
  return (
    <div className={`control-metric tone-${tone}`}>
      <span className="metric-icon">
        <Icon size={19} />
      </span>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <span className="metric-hint">{hint}</span>
    </div>
  );
}

function Distribution({ title, items, values, total }) {
  return (
    <section className="control-panel">
      <h2>{title}</h2>
      <div className="distribution" aria-hidden="true">
        {items.map(([key, label, color]) => (
          <span
            key={key}
            title={label}
            style={{ background: color, flexGrow: values[key] }}
          />
        ))}
      </div>
      <dl className="chart-legend">
        {items.map(([key, label, color]) => (
          <div key={key}>
            <dt>
              <span style={{ background: color }} />
              {label}
            </dt>
            <dd>
              {formatCount.format(values[key])}{" "}
              <small>
                {total ? Math.round((values[key] * 100) / total) : 0}%
              </small>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ControlCenter({ api, openBoard, createBoard, revision }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [manual, setManual] = useState(0);
  const [loading, setLoading] = useState(true);

  useLiveRefresh(
    true,
    async (signal) => {
      try {
        const zone =
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          "America/Santiago";
        const snapshot = await api.request(
          `/dashboard?tz=${encodeURIComponent(zone)}`,
          { signal },
        );
        if (!signal.aborted) {
          setData(snapshot);
          setError("");
        }
      } catch (error) {
        if (!signal.aborted)
          setError(error.message || "No pudimos actualizar los datos.");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [revision, manual],
  );

  return (
    <div className="control-center">
      <section className="control-intro">
        <div>
          <p className="eyebrow">OPERACIONES DE EQUIPO</p>
          <h1>Centro de control</h1>
          <p>
            Coordina entregas y detecta tareas que requieren atención antes de
            que afecten al equipo.
          </p>
        </div>
        <div className="control-sync">
          <span className="sync-indicator">
            {error ? <TriangleAlert size={16} /> : <Activity size={16} />}
            {error
              ? "Actualización pendiente"
              : `Actualiza cada ${refreshSeconds} s`}
          </span>
          <button
            className="button secondary"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setManual((n) => n + 1);
            }}
          >
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>
      </section>
      {error && (
        <p className="alert" role="alert">
          {error}
          {data ? " Se muestran los últimos datos disponibles." : ""}
        </p>
      )}
      {data ? (
        <>
          <div className="control-metrics">
            <Metric
              icon={Layers3}
              label="Tableros accesibles"
              value={formatCount.format(data.totals.boards)}
              hint="Incluye todos tus roles"
              tone="blue"
            />
            <Metric
              icon={ListTodo}
              label="Tarjetas totales"
              value={formatCount.format(data.totals.cards)}
              hint={`${formatCount.format(data.status.doing)} en progreso`}
              tone="violet"
            />
            <Metric
              icon={CheckCircle2}
              label="Avance total"
              value={`${data.totals.progress}%`}
              hint={`${formatCount.format(data.status.done)} completadas`}
              tone="green"
            />
            <Metric
              icon={CircleAlert}
              label="Vencidas"
              value={formatCount.format(data.totals.overdue)}
              hint={`${formatCount.format(data.totals.dueToday)} vencen hoy`}
              tone="red"
            />
          </div>
          <OperationsPanel api={api} openBoard={openBoard} revision={revision}/>
          <div className="control-charts">
            <Distribution
              title="Distribución por estado"
              items={columns}
              values={data.status}
              total={data.totals.cards}
            />
            <Distribution
              title="Prioridades de las tarjetas"
              items={priorities}
              values={data.priority}
              total={data.totals.cards}
            />
          </div>
          <section className="control-panel">
            <h2>Avance por tablero</h2>
            {data.boards.length ? (
              <div className="board-overview-list">
                {data.boards.map((board) => (
                  <article className="board-overview" key={board.id}>
                    <div className="board-overview-main">
                      <h3>{board.title}</h3>
                      <p>
                        {board.objective || "Sin objetivo definido"} ·{" "}
                        {roles[board.role]}
                      </p>
                      <ul className="overview-counts">
                        {board.columns.map((column) => (
                          <li key={column.id}>
                            {column.name} <strong>{column.count}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <label className="board-overview-progress">
                      <strong>{board.progress}%</strong>
                      <progress
                        aria-label={`Avance de ${board.title}`}
                        max="100"
                        value={board.progress}
                      />
                      <span>
                        {board.done} de {board.total} completadas
                      </span>
                    </label>
                    <button
                      className="button secondary"
                      onClick={() => openBoard(board.id)}
                    >
                      Abrir tablero <ArrowRight size={16} />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="control-empty">
                <p>Crea un tablero para empezar a seguir el trabajo.</p>
                <button className="button primary" onClick={createBoard}>
                  Crear tablero
                </button>
              </div>
            )}
          </section>
          <section className="control-panel">
            <h2>
              <CalendarClock size={21} /> Tarjetas vencidas
            </h2>
            {data.overdueCards.length ? (
              <ul className="overdue-list">
                {data.overdueCards.map((card) => (
                  <li key={card.id}>
                    <div>
                      <strong>{card.title}</strong>
                      <span>
                        {card.boardTitle} · {card.columnTitle}
                      </span>
                    </div>
                    <span
                      className={`priority priority-${card.priority.toLowerCase()}`}
                    >
                      {card.priority === "HIGH"
                        ? "Alta"
                        : card.priority === "MEDIUM"
                          ? "Media"
                          : "Baja"}
                    </span>
                    <time dateTime={card.dueAt}>{displayDay(card.dueAt)}</time>
                    <button
                      className="icon"
                      aria-label={`Abrir tablero de ${card.title}`}
                      onClick={() => openBoard(card.boardId)}
                    >
                      <ArrowRight size={17} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                No hay tarjetas abiertas con fecha vencida.
              </p>
            )}
            {data.totals.overdue > data.overdueCards.length && (
              <p className="muted">
                Se muestran las {data.overdueCards.length} más antiguas de{" "}
                {data.totals.overdue}.
              </p>
            )}
          </section>
          <p className="control-timestamp">
            <Clock3 size={14} /> Última lectura: {displayTime(data.asOf)}. Las
            tarjetas de hoy no se consideran vencidas.
          </p>
        </>
      ) : (
        loading && (
          <p className="muted" aria-live="polite">
            Cargando datos de los tableros…
          </p>
        )
      )}
    </div>
  );
}
