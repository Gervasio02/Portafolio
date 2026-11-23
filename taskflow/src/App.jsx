import { useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  GripVertical,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Moon,
  Plus,
  Search,
  SlidersHorizontal,
  Sun,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createApi } from "./api.js";
import { TaskCalendar } from "./TaskCalendar.jsx";
import { ControlCenter } from "./ControlCenter.jsx";
import { useLiveRefresh } from "./live.js";

const priorities = { HIGH: "Alta", MEDIUM: "Media", LOW: "Baja" };
const roles = { OWNER: "Dueño", EDITOR: "Editor", VIEWER: "Lector" };
const api = createApi();
const invitation = () =>
  new URLSearchParams(window.location.hash.slice(1)).get("invitation");
const displayDate = (value) =>
  new Date(value).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

export function filterCards(cards, search, priority) {
  const query = search.trim().toLocaleLowerCase("es");
  return cards.filter(
    (card) =>
      (!priority || card.priority === priority) &&
      (!query ||
        [card.title, card.description, ...card.labels].some((field) =>
          field.toLocaleLowerCase("es").includes(query),
        )),
  );
}

function Logo() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <LayoutGrid size={22} strokeWidth={2.5} />
      </div>
      <span>TaskFlow</span>
    </div>
  );
}

export function AuthPage({ pendingInvitation, signIn }) {
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(method, fields) {
    setBusy(true);
    setError("");
    try {
      await signIn(method, fields);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <div className="auth-left">
        <Logo />
        <section className="auth-card">
          <p className="eyebrow">ESPACIO DE TRABAJO</p>
          <h1>
            {mode === "login" ? "Bienvenido a TaskFlow" : "Crea tu cuenta"}
          </h1>
          <p className="muted">
            {pendingInvitation
              ? "Usa el correo que recibió la invitación."
              : "Organiza el trabajo de tu equipo de principio a fin."}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit(
                mode,
                Object.fromEntries(new FormData(event.currentTarget)),
              );
            }}
          >
            {mode === "register" && (
              <label>
                Nombre
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>
            )}
            <label>
              Correo
              <input
                name="email"
                type="email"
                placeholder="nombre@ejemplo.cl"
                autoComplete="email"
                required
              />
            </label>
            <label>
              Contraseña
              <input
                name="password"
                type="password"
                placeholder="Al menos 8 caracteres"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={8}
                required
              />
            </label>
            {error && (
              <p className="alert" role="alert">
                {error}
              </p>
            )}
            <button className="button primary full" disabled={busy}>
              {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}{" "}
              <ArrowRight size={17} />
            </button>
          </form>
          <button
            className="button ghost full"
            disabled={busy}
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Crear una cuenta" : "Ya tengo una cuenta"}
          </button>
          {!pendingInvitation && (
            <button
              className="button ghost full"
              disabled={busy}
              onClick={() =>
                submit("login", {
                  email: "demo@taskflow.example",
                  password: "TaskFlow-demo-2026",
                })
              }
            >
              Entrar como invitado de demo
            </button>
          )}
        </section>
      </div>
      <aside className="auth-art" aria-hidden="true">
        <div className="art-panel">
          <div className="art-bar">
            <LayoutGrid size={20} /> <span>Proyecto de equipo</span>
            <span className="art-dots">···</span>
          </div>
          <div className="art-columns">
            {[
              ["Por hacer", "Diseñar experiencia", "Revisar objetivos"],
              ["En progreso", "Preparar el lanzamiento"],
              ["Hecho", "Definir el alcance", "Reunión de inicio"],
            ].map(([title, ...cards]) => (
              <div key={title}>
                <strong>{title}</strong>
                {cards.map((card) => (
                  <div className="art-card" key={card}>
                    <span />
                    <p>{card}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <h2>
          Todo el trabajo,
          <br />
          en un mismo lugar.
        </h2>
      </aside>
    </div>
  );
}

export function Card({ card, edit, draggable }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { columnId: card.columnId },
    disabled: !draggable,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`task-card${isDragging ? " dragging" : ""}`}
    >
      <div className="task-top">
        <span className={`priority priority-${card.priority.toLowerCase()}`}>
          {priorities[card.priority]}
        </span>
        {draggable && (
          <button
            className="icon drag"
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Arrastrar ${card.title}`}
          >
            <GripVertical size={17} />
          </button>
        )}
      </div>
      <button className="task-title" onClick={edit}>
        {card.title}
      </button>
      {card.description && <p className="card-desc">{card.description}</p>}
      {card.labels.length > 0 && (
        <div className="tags">
          {card.labels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      )}
      {card.dueAt && (
        <p className="card-date">
          <CalendarDays size={14} />
          {displayDate(card.dueAt)}
        </p>
      )}
    </article>
  );
}

function Column({
  column,
  index,
  search,
  priority,
  editable,
  newCard,
  editCard,
  configureWip,
}) {
  const visible = filterCards(column.cards, search, priority);
  const draggable = editable && !search.trim() && !priority;
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { columnId: column.id },
    disabled: !draggable,
  });
  return (
    <section
      ref={setNodeRef}
      className={`board-column col-${index}${isOver ? " is-over" : ""}`}
    >
      <header className="column-head">
        <span className="column-dot" />
        <h2>{column.title}</h2>
        <span className="count">{visible.length}{column.wipLimit ? ` / ${column.wipLimit}` : ""}</span>
        {editable && (
          <button
            className="icon"
            aria-label={`Nueva tarjeta en ${column.title}`}
            onClick={newCard}
          >
            <Plus size={18} />
          </button>
        )}
      </header>
      {configureWip && <form onSubmit={event => {
        event.preventDefault();
        const value = new FormData(event.currentTarget).get("wip");
        void configureWip(value ? Number(value) : null);
      }}><label>Límite de trabajo en curso<input name="wip" type="number" min="1" max="10000" defaultValue={column.wipLimit || ""} placeholder="Sin límite" /></label><button type="submit">Guardar límite</button></form>}
      <SortableContext
        items={visible.map(({ id }) => id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="column-cards">
          {visible.map((card) => (
            <Card
              key={card.id}
              card={card}
              draggable={draggable}
              edit={() => editCard(card)}
            />
          ))}
          {!visible.length && (
            <p className="empty-col">
              {column.cards.length
                ? "Sin coincidencias"
                : "Aún no hay tarjetas"}
            </p>
          )}
        </div>
      </SortableContext>
      {editable && (
        <button className="column-add" onClick={newCard}>
          <Plus size={16} /> Añadir tarjeta
        </button>
      )}
    </section>
  );
}

function Modal({ title, close, error, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button className="icon" aria-label="Cerrar" onClick={close}>
          <X size={20} />
        </button>
      </header>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {children}
    </dialog>
  );
}

export function CardActivity({ boardId, cardId, editable, client = api }) {
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const result = await client.request(`/boards/${boardId}/cards/${cardId}/activity`, { signal: controller.signal });
        if (!controller.signal.aborted) { setEntries(result); setError(""); }
      } catch (e) { if (!controller.signal.aborted) setError(e.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load();
    const timer = setInterval(load, 15000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [boardId, cardId, client, version]);
  return <section aria-label="Actividad de la tarjeta"><h3>Comentarios y actividad</h3>
    {loading && <p role="status">Cargando actividad…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !entries.length && <p>Aún no hay actividad.</p>}
    <ol>{entries.map(entry => <li key={entry.id}><strong>{entry.actor?.name || "Usuario eliminado"}</strong> · {new Date(entry.createdAt).toLocaleString("es-CL")}<p>{entry.body}</p></li>)}</ol>
    <p>Se muestran los 100 eventos más recientes. Se actualiza cada 15 segundos.</p>
    {editable && <form onSubmit={async event => {
      event.preventDefault(); const form = event.currentTarget;
      const body = new FormData(form).get("comment"); setBusy(true); setError("");
      try { await client.request(`/boards/${boardId}/cards/${cardId}/comments`, { method: "POST", body: { body } }); form.reset(); setVersion(v => v + 1); }
      catch (e) { setError(e.message); }
      finally { setBusy(false); }
    }}><label>Nuevo comentario<textarea name="comment" required maxLength={2000} rows={3} /></label><button disabled={busy} type="submit">{busy ? "Guardando…" : "Publicar comentario"}</button></form>}
  </section>;
}

function CardForm({
  boardId,
  card,
  columnId,
  columns,
  members = [],
  submit,
  remove,
  editable,
  close,
  busy,
  error,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <Modal
      title={card ? card.title : "Nueva tarjeta"}
      close={close}
      error={error}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const { labels, ...fields } = Object.fromEntries(
            new FormData(event.currentTarget),
          );
          void submit({
            ...fields,
            labels: labels
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
            dueAt: fields.dueAt || null,
            assigneeId: fields.assigneeId || null,
            slaHours: fields.slaHours ? Number(fields.slaHours) : null,
          });
        }}
      >
        <fieldset disabled={!editable || busy}>
          <label>
            Título
            <input
              name="title"
              defaultValue={card?.title || ""}
              required
              maxLength={120}
            />
          </label>
          <label>
            Descripción
            <textarea
              name="description"
              rows="3"
              maxLength={3000}
              defaultValue={card?.description || ""}
            />
          </label>
          <div className="form-grid">
            <label>
              Prioridad
              <select name="priority" defaultValue={card?.priority || "MEDIUM"}>
                {Object.entries(priorities).map(([value, name]) => (
                  <option key={value} value={value}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fecha límite
              <input
                name="dueAt"
                type="date"
                defaultValue={card?.dueAt?.slice(0, 10) || ""}
              />
            </label>
          </div>
          <label>
            Columna
            <select name="columnId" defaultValue={card?.columnId || columnId}>
              {columns.map((column) => (
                <option value={column.id} key={column.id}>
                  {column.title}
                </option>
              ))}
            </select>
          </label>
          <label>SLA en horas desde la creación<input name="slaHours" type="number" min="1" max="8760" defaultValue={card?.slaDueAt ? Math.round((new Date(card.slaDueAt)-new Date(card.createdAt))/3600000) : ""} placeholder="Sin SLA" /></label>
          <label>Responsable<select name="assigneeId" defaultValue={card?.assigneeId || ""}><option value="">Sin responsable</option>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
          <label>
            Etiquetas
            <input
              name="labels"
              defaultValue={card?.labels.join(", ") || ""}
              placeholder="Diseño, Contenido"
            />
          </label>
          <div className="modal-actions">
            {card && (
              <button
                className="button danger"
                type="button"
                onClick={() =>
                  confirmDelete ? remove() : setConfirmDelete(true)
                }
              >
                <Trash2 size={16} />{" "}
                {confirmDelete ? "Confirmar eliminación" : "Eliminar"}
              </button>
            )}
            <button type="submit" className="button primary">
              Guardar tarjeta
            </button>
          </div>
        </fieldset>
      </form>
      {card && <CardActivity key={card.id} boardId={boardId} cardId={card.id} editable={editable} />}
    </Modal>
  );
}

function BoardForm({ board, close, submit, remove, busy, error }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <Modal
      title={board ? "Editar tablero" : "Crear tablero"}
      close={close}
      error={error}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(Object.fromEntries(new FormData(event.currentTarget)));
        }}
      >
        <label>
          Nombre del tablero
          <input
            name="title"
            defaultValue={board?.title || ""}
            placeholder="Lanzamiento de producto"
            required
            maxLength={100}
          />
        </label>
        <label>
          Objetivo del tablero
          <textarea
            name="objective"
            defaultValue={board?.objective || ""}
            placeholder="Por ejemplo, cerrar las incidencias antes de cada entrega."
            maxLength={280}
            rows={2}
          />
        </label>
        <div className="modal-actions">
          {board && (
            <button
              type="button"
              className="button danger"
              disabled={busy}
              onClick={() =>
                confirmDelete ? remove() : setConfirmDelete(true)
              }
            >
              <Trash2 size={16} />{" "}
              {confirmDelete ? "Confirmar eliminación" : "Eliminar"}
            </button>
          )}
          <button className="button primary" disabled={busy}>
            {board ? "Guardar" : "Crear tablero"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Members({ board, close, invite, changeRole, remove, busy, error }) {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  return (
    <Modal title="Personas del tablero" close={close} error={error}>
      {board.role === "OWNER" && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const result = await invite(
              Object.fromEntries(new FormData(event.currentTarget)),
            );
            if (result) {
              setLink(`${window.location.origin}/#invitation=${result.token}`);
              setCopied(false);
            }
          }}
        >
          <label>
            Correo electrónico
            <input
              name="email"
              type="email"
              placeholder="equipo@ejemplo.cl"
              required
            />
          </label>
          <label>
            Rol
            <select name="role">
              <option value="EDITOR">Editor</option>
              <option value="VIEWER">Lector</option>
            </select>
          </label>
          <button className="button primary full" disabled={busy}>
            <UserPlus size={16} /> Generar invitación
          </button>
          {link && (
            <div className="invite-link">
              <label>
                Envía este enlace al correo indicado
                <input
                  value={link}
                  readOnly
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <button
                className="button ghost full"
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? "Enlace copiado" : "Copiar enlace"}
              </button>
            </div>
          )}
        </form>
      )}
      <ul className="members">
        {board.members.map((member) => (
          <li key={member.id}>
            <strong>{member.name}</strong>
            {board.role === "OWNER" && member.role !== "OWNER" ? (
              <>
                <select
                  aria-label={`Rol de ${member.name}`}
                  value={member.role}
                  disabled={busy}
                  onChange={(event) =>
                    changeRole(member.id, event.target.value)
                  }
                >
                  <option value="EDITOR">Editor</option>
                  <option value="VIEWER">Lector</option>
                </select>
                <button
                  className="icon"
                  disabled={busy}
                  aria-label={`Quitar a ${member.name}`}
                  onClick={() => remove(member.id)}
                >
                  <X size={17} />
                </button>
              </>
            ) : (
              <span>{roles[member.role]}</span>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export function App() {
  const [user, setUser] = useState(null);
  const [starting, setStarting] = useState(true);
  const [boards, setBoards] = useState([]);
  const [selected, setSelected] = useState("");
  const [showControl, setShowControl] = useState(true);
  const [revision, setRevision] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [board, setBoard] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [view, setView] = useState("board");
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("taskflow-theme") || "light",
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  async function loadBoards(preferred) {
    const list = await api.request("/boards");
    setBoards(list);
    setSelected(
      list.find((item) => item.id === preferred)?.id ?? list[0]?.id ?? "",
    );
  }

  function openBoard(id) {
    setError("");
    setSelected(id);
    setShowControl(false);
  }

  async function enter(person) {
    setUser(person);
    let preferred;
    const token = invitation();
    if (token) {
      try {
        const result = await api.request("/invitations/accept", {
          method: "POST",
          body: { token },
        });
        preferred = result.boardId;
        setShowControl(false);
        history.replaceState(null, "", location.pathname);
      } catch (error) {
        setError(error.message);
      }
    }
    await loadBoards(preferred);
  }

  useEffect(() => {
    api
      .refresh()
      .then(enter)
      .catch(() => {})
      .finally(() => setStarting(false));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("taskflow-theme", theme);
  }, [theme]);

  useEffect(() => {
    setBoard(null);
    setSearch("");
    setPriority("");
  }, [selected]);

  useLiveRefresh(
    Boolean(user && !busy && !dialog && !dragging),
    async (signal) => {
      try {
        const list = await api.request("/boards", { signal });
        if (signal.aborted) return;
        setBoards(list);
        if (showControl) return;
        if (!selected || !list.some((item) => item.id === selected)) {
          setSelected(list[0]?.id || "");
          return;
        }
        const updated = await api.request(`/boards/${selected}`, { signal });
        if (!signal.aborted) setBoard(updated);
      } catch (error) {
        if (!signal.aborted && error.status === 404) setBoard(null);
        if (!signal.aborted) setError(error.message);
      }
    },
    [user?.id, selected, showControl],
  );

  async function perform(action) {
    setError("");
    setBusy(true);
    try {
      const result = await action();
      setRevision((previous) => previous + 1);
      return result;
    } catch (error) {
      setError(error.message);
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  const reload = async () => setBoard(await api.request(`/boards/${selected}`));

  async function move(cardId, columnId, beforeId = null) {
    await api.request(`/boards/${selected}/cards/${cardId}/move`, {
      method: "POST",
      body: { columnId, beforeId },
    });
  }

  if (starting)
    return (
      <main className="center" aria-busy="true">
        <Logo />
        <p>Cargando espacio de trabajo…</p>
      </main>
    );
  if (!user)
    return (
      <AuthPage
        pendingInvitation={invitation()}
        signIn={async (method, fields) =>
          enter(await api.signIn(method, fields))
        }
      />
    );

  const allCards = board?.columns.flatMap((column) => column.cards) ?? [];
  const done = board?.columns.at(-1)?.cards.length ?? 0;
  const progress = allCards.length
    ? Math.round((done * 100) / allCards.length)
    : 0;
  const editable = board && board.role !== "VIEWER";

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <Logo />
        <nav className="overview-nav" aria-label="Operaciones">
          <button
            className={showControl ? "active" : ""}
            aria-current={showControl ? "page" : undefined}
            disabled={busy}
            onClick={() => {
              setError("");
              setShowControl(true);
            }}
          >
            <LayoutDashboard size={17} /> Centro de control
          </button>
        </nav>
        <div className="side-heading">
          <span>TABLEROS</span>
          <button
            className="icon"
            aria-label="Crear tablero"
            onClick={() => setDialog({ type: "board" })}
          >
            <Plus size={19} />
          </button>
        </div>
        <nav aria-label="Tableros">
          {boards.map((item) => (
            <button
              key={item.id}
              className={!showControl && item.id === selected ? "active" : ""}
              aria-current={
                !showControl && item.id === selected ? "page" : undefined
              }
              disabled={busy}
              onClick={() => openBoard(item.id)}
            >
              <LayoutGrid size={17} />
              {item.title}
            </button>
          ))}
          {!boards.length && <p>Aquí aparecerán tus tableros.</p>}
        </nav>
        <div className="side-bottom">
          <button
            className="theme"
            aria-label={theme === "light" ? "Modo oscuro" : "Modo claro"}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            <span>{theme === "light" ? "Modo oscuro" : "Modo claro"}</span>
          </button>
          <div className="profile">
            <span className="avatar">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{user.name}</strong>
              <span>Mi espacio</span>
            </div>
            <button
              className="icon"
              aria-label="Cerrar sesión"
              onClick={() =>
                perform(async () => {
                  await api.logout();
                  setBoard(null);
                  setBoards([]);
                  setSelected("");
                  setShowControl(true);
                  setUser(null);
                })
              }
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <main className="workspace">
        <div className="topbar">
          <span>
            <LayoutGrid size={16} /> Espacio de trabajo{" "}
            <ArrowDownRight size={16} />{" "}
            <strong>
              {showControl ? "Operaciones" : board?.title || "Tableros"}
            </strong>
          </span>
          <button
            className="icon"
            aria-label="Ayuda"
            onClick={() => setDialog({ type: "help" })}
          >
            <CircleHelp size={20} />
          </button>
        </div>
        {error && !dialog && (
          <div className="alert error-bar" role="alert">
            {error}
            <button
              className="icon"
              aria-label="Cerrar aviso"
              onClick={() => setError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {showControl ? (
          <ControlCenter
            api={api}
            revision={revision}
            openBoard={openBoard}
            createBoard={() => setDialog({ type: "board" })}
          />
        ) : board ? (
          <>
            <section className="workspace-header">
              <div>
                <p className="eyebrow">TABLERO KANBAN</p>
                <div className="title-row">
                  <h1>{board.title}</h1>
                  {board.role === "OWNER" && (
                    <button
                      className="icon"
                      aria-label="Editar tablero"
                      onClick={() => setDialog({ type: "board", board })}
                    >
                      <ChevronDown size={21} />
                    </button>
                  )}
                </div>
                {board.objective && (
                  <p className="board-objective">{board.objective}</p>
                )}
                <p className="muted">
                  {allCards.length} tarjetas · {done} completadas ·{" "}
                  {roles[board.role]}
                </p>
              </div>
              <div className="header-actions">
                <button
                  className="button secondary"
                  onClick={() => setDialog({ type: "members" })}
                >
                  <UserPlus size={17} />{" "}
                  {board.role === "OWNER" ? "Invitar" : "Miembros"}
                </button>
                {editable && (
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() =>
                      setDialog({ type: "card", columnId: board.columns[0].id })
                    }
                  >
                    <Plus size={19} /> Nueva tarjeta
                  </button>
                )}
              </div>
            </section>
            <div className="board-summary">
              <div className="toolbar">
                <label className="search">
                  <Search size={18} />
                  <input
                    aria-label="Buscar tarjetas"
                    placeholder="Buscar tarjetas…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <label className="filter">
                  <SlidersHorizontal size={17} />
                  <select
                    aria-label="Filtrar por prioridad"
                    value={priority}
                    onChange={(event) => setPriority(event.target.value)}
                  >
                    <option value="">Toda prioridad</option>
                    {Object.entries(priorities).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="progress">
                <span>Avance</span>
                <progress
                  aria-label="Avance del tablero"
                  value={progress}
                  max="100"
                />
                <strong>{progress}%</strong>
              </div>
            </div>
            <div role="group" aria-label="Vista de tareas"><button type="button" aria-pressed={view==="board"} onClick={()=>setView("board")}>Tablero</button><button type="button" aria-pressed={view==="calendar"} onClick={()=>setView("calendar")}>Calendario</button></div>
            {view === "calendar" ? <TaskCalendar cards={filterCards(board.columns.flatMap(column=>column.cards),search,priority)} openCard={card=>setDialog({type:"card",card})}/> : <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={() => setDragging(true)}
              onDragCancel={() => setDragging(false)}
              onDragEnd={({ active, over }) => {
                setDragging(false);
                const columnId = over?.data.current?.columnId;
                if (!columnId || active.id === over.id || busy) return;
                const destination = board.columns.find(
                  (column) => column.id === columnId,
                ).cards;
                const from = destination.findIndex(
                  (card) => card.id === active.id,
                );
                const to = destination.findIndex((card) => card.id === over.id);
                const beforeId =
                  to < 0
                    ? null
                    : from >= 0 && from < to
                      ? (destination[to + 1]?.id ?? null)
                      : over.id;
                void perform(async () => {
                  await move(active.id, columnId, beforeId);
                  await reload();
                });
              }}
            >
              <div className="board-columns">
                {board.columns.map((column, index) => (
                  <Column
                    key={column.id}
                    column={column}
                    index={index}
                    search={search}
                    priority={priority}
                    editable={editable}
                    newCard={() =>
                      setDialog({ type: "card", columnId: column.id })
                    }
                    configureWip={board.role === "OWNER" ? limit => perform(async () => {
                      await api.request(`/boards/${selected}/columns/${column.id}`, { method: "PATCH", body: { wipLimit: limit } });
                      await reload();
                    }) : null}
                    editCard={(card) => setDialog({ type: "card", card })}
                  />
                ))}
              </div>
            </DndContext>}
          </>
        ) : selected && !error ? (
          <p className="empty-board" aria-busy="true">
            Cargando tablero…
          </p>
        ) : (
          <section className="empty-board">
            <LayoutGrid size={42} />
            <h1>Tu primer tablero</h1>
            <p>Empieza con un tablero para organizar el trabajo.</p>
            <button
              className="button primary"
              onClick={() => setDialog({ type: "board" })}
            >
              <Plus size={17} /> Crear tablero
            </button>
          </section>
        )}
      </main>
      {dialog?.type === "card" && (
        <CardForm
          boardId={selected}
          members={board.members}
          {...dialog}
          columns={board.columns}
          editable={editable}
          busy={busy}
          error={error}
          close={() => {
            setError("");
            setDialog(null);
          }}
          submit={(fields) =>
            perform(async () => {
              if (dialog.card) {
                await api.request(
                  `/boards/${selected}/cards/${dialog.card.id}`,
                  { method: "PATCH", body: fields },
                );
              } else
                await api.request(`/boards/${selected}/cards`, {
                  method: "POST",
                  body: fields,
                });
              await reload();
              setDialog(null);
            })
          }
          remove={() =>
            perform(async () => {
              await api.request(`/boards/${selected}/cards/${dialog.card.id}`, {
                method: "DELETE",
              });
              await reload();
              setDialog(null);
            })
          }
        />
      )}
      {dialog?.type === "board" && (
        <BoardForm
          board={dialog.board}
          busy={busy}
          error={error}
          close={() => {
            setError("");
            setDialog(null);
          }}
          submit={(fields) =>
            perform(async () => {
              const result = await api.request(
                dialog.board ? `/boards/${selected}` : "/boards",
                { method: dialog.board ? "PATCH" : "POST", body: fields },
              );
              await loadBoards(result.id);
              if (dialog.board) await reload();
              else openBoard(result.id);
              setDialog(null);
            })
          }
          remove={() =>
            perform(async () => {
              await api.request(`/boards/${selected}`, { method: "DELETE" });
              await loadBoards();
              setDialog(null);
            })
          }
        />
      )}
      {dialog?.type === "members" && (
        <Members
          board={board}
          busy={busy}
          error={error}
          close={() => {
            setError("");
            setDialog(null);
          }}
          invite={(fields) =>
            perform(() =>
              api.request(`/boards/${selected}/invitations`, {
                method: "POST",
                body: fields,
              }),
            )
          }
          changeRole={(id, role) =>
            perform(async () => {
              await api.request(`/boards/${selected}/members/${id}`, {
                method: "PATCH",
                body: { role },
              });
              await reload();
            })
          }
          remove={(id) =>
            perform(async () => {
              await api.request(`/boards/${selected}/members/${id}`, {
                method: "DELETE",
              });
              await reload();
            })
          }
        />
      )}
      {dialog?.type === "help" && (
        <Modal title="Cómo usar TaskFlow" close={() => setDialog(null)}>
          <p>
            Arrastra una tarjeta para cambiar su posición o abre sus detalles y
            selecciona otra columna. Los dueños pueden invitar lectores y
            editores.
          </p>
        </Modal>
      )}
    </div>
  );
}
