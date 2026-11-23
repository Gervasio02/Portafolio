import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CircleSlash, Settings2, Trash2 } from "lucide-react";
import {
  account,
  api,
  type Block,
  type Booking,
  type Court,
  type Schedule,
  type Service,
  type ServiceData,
  type Sport,
} from "./api";
import { BookingList } from "./ReservationsPage";
import {
  dateKey,
  dateTime,
  hourLabel,
  price,
  shiftDate,
  SPORTS,
  today,
  WEEKDAYS,
} from "./format";

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8);

function EditService({
  service,
  courts,
  close,
}: {
  service?: Service;
  courts: Court[];
  close?: () => void;
}) {
  const cache = useQueryClient();
  const save = useMutation({
    mutationFn: (data: ServiceData) =>
      api<Service>(
        service ? `/admin/services/${service.id}` : "/admin/services",
        service ? "PUT" : "POST",
        data,
      ),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["services"] }),
        cache.invalidateQueries({ queryKey: ["admin-services"] }),
      ]);
      close?.();
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    save.mutate({
      court_id: service?.court_id ?? Number(form.get("court")),
      name: String(form.get("name")),
      description: String(form.get("description")),
      price: Number(form.get("price")),
      sport: form.get("sport") as Sport,
      active: form.has("active"),
    });
  }
  return (
    <form className="form-stack admin-form" onSubmit={submit}>
      <h3>{service ? `Editar ${service.name}` : "Crear servicio"}</h3>
      <div className="two-columns">
        <label>
          Nombre
          <input
            required
            minLength={2}
            maxLength={100}
            name="name"
            defaultValue={service?.name}
          />
        </label>
        <label>
          Cancha
          <select
            name="court"
            defaultValue={service?.court_id}
            disabled={Boolean(service)}
          >
            {courts.map((court) => (
              <option key={court.id} value={court.id}>
                {court.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Deporte
          <select name="sport" defaultValue={service?.sport}>
            {Object.entries(SPORTS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Precio (CLP)
          <input
            required
            type="number"
            name="price"
            min={1}
            max={200000}
            defaultValue={service?.price}
          />
        </label>
      </div>
      <label>
        Descripción
        <textarea
          name="description"
          maxLength={240}
          defaultValue={service?.description}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          name="active"
          defaultChecked={service?.active ?? true}
        />{" "}
        Visible para clientes
      </label>
      {save.error && (
        <p role="alert" className="error">
          {save.error.message}
        </p>
      )}
      {save.isSuccess && (
        <p role="status" className="success">
          Servicio guardado.
        </p>
      )}
      <button
        className="btn-primary"
        disabled={!courts.length || save.isPending}
      >
        {save.isPending ? "Guardando…" : "Guardar servicio"}
      </button>
    </form>
  );
}

function ManageServices({ courts }: { courts: Court[] }) {
  const [editing, setEditing] = useState<number | null>(null);
  const query = useQuery({
    queryKey: ["admin-services"],
    queryFn: () => api<Service[]>("/admin/services"),
  });
  const current = query.data?.find((service) => service.id === editing);
  return (
    <section className="panel admin-stack">
      <h2>
        <Settings2 size={20} /> Servicios
      </h2>
      {query.isPending && <p>Cargando servicios…</p>}
      {query.error && (
        <p role="alert" className="error">
          {query.error.message}
        </p>
      )}
      <ul className="plain-list">
        {query.data?.map((service) => (
          <li key={service.id}>
            <div>
              <strong>{service.name}</strong>
              <p className="small muted">
                {service.active ? "Visible" : "Oculto"} · {service.court}
              </p>
            </div>
            <button
              type="button"
              className="btn-text"
              onClick={() => setEditing(service.id)}
            >
              Editar
            </button>
          </li>
        ))}
      </ul>
      <EditService
        key={current?.id ?? "new"}
        service={current}
        courts={courts}
        close={current ? () => setEditing(null) : undefined}
      />
      {current && (
        <button
          className="btn-text"
          type="button"
          onClick={() => setEditing(null)}
        >
          Volver a crear servicio
        </button>
      )}
    </section>
  );
}

function ManageSchedule({ courtId }: { courtId: number }) {
  const cache = useQueryClient();
  const [weekday, setWeekday] = useState(0);
  const [edited, setEdited] = useState<number[] | null>(null);
  const hoursQuery = useQuery({
    queryKey: ["schedule", courtId],
    queryFn: () => api<Schedule[]>(`/admin/courts/${courtId}/schedule`),
  });
  const hours =
    edited ??
    hoursQuery.data?.find((entry) => entry.weekday === weekday)?.hours ??
    [];
  const save = useMutation({
    mutationFn: () =>
      api<Schedule>(`/admin/courts/${courtId}/schedule`, "PUT", {
        weekday,
        hours,
      }),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["schedule", courtId] }),
        cache.invalidateQueries({ queryKey: ["availability"] }),
      ]);
      setEdited(null);
    },
  });
  return (
    <div className="form-stack">
      <h3>Horario semanal</h3>
      <label>
        Día de la semana
        <select
          value={weekday}
          onChange={(e) => {
            setWeekday(Number(e.target.value));
            setEdited(null);
            save.reset();
          }}
        >
          {WEEKDAYS.map((label, i) => (
            <option key={label} value={i}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {hoursQuery.error && (
        <p role="alert" className="error">
          {hoursQuery.error.message}
        </p>
      )}
      {hoursQuery.isPending ? (
        <p>Cargando horario…</p>
      ) : (
        <div className="slot-grid">
          {HOURS.map((hour) => (
            <button
              className="slot"
              type="button"
              key={hour}
              aria-pressed={hours.includes(hour)}
              onClick={() => {
                setEdited(
                  hours.includes(hour)
                    ? hours.filter((value) => value !== hour)
                    : [...hours, hour],
                );
                save.reset();
              }}
            >
              {hourLabel(hour)}
            </button>
          ))}
        </div>
      )}
      {save.error && (
        <p role="alert" className="error">
          {save.error.message}
        </p>
      )}
      {save.isSuccess && (
        <p role="status" className="success">
          Horario guardado.
        </p>
      )}
      <button
        className="btn-primary"
        disabled={edited === null || save.isPending}
        type="button"
        onClick={() => save.mutate()}
      >
        Guardar horario
      </button>
    </div>
  );
}

function ManageBlocks({ courtId }: { courtId: number }) {
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["blocks", courtId],
    queryFn: () => api<Block[]>(`/admin/courts/${courtId}/blocks`),
  });
  const mutation = useMutation({
    mutationFn: ({ id, data }: { id?: number; data?: object }) =>
      id
        ? api<void>(`/admin/blocks/${id}`, "DELETE")
        : api<void>(`/admin/courts/${courtId}/blocks`, "POST", data),
    onSuccess: () =>
      Promise.all([
        cache.invalidateQueries({ queryKey: ["blocks", courtId] }),
        cache.invalidateQueries({ queryKey: ["availability"] }),
      ]),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutation.mutate({
      data: {
        day: form.get("day"),
        hour: Number(form.get("hour")),
        reason: form.get("reason"),
      },
    });
  }
  return (
    <>
      <form className="form-stack" onSubmit={submit}>
        <h3>
          <CircleSlash size={17} /> Bloquear franja
        </h3>
        <div className="two-columns">
          <label>
            Fecha
            <input
              name="day"
              type="date"
              defaultValue={shiftDate(today(), 1)}
              min={today()}
              max={shiftDate(today(), 60)}
              required
            />
          </label>
          <label>
            Hora
            <select name="hour">
              {HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {hourLabel(hour)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Motivo
          <input name="reason" minLength={2} maxLength={160} required />
        </label>
        {mutation.error && (
          <p role="alert" className="error">
            {mutation.error.message}
          </p>
        )}
        <button className="btn-primary" disabled={mutation.isPending}>
          Bloquear
        </button>
      </form>
      {query.error && (
        <p role="alert" className="error">
          {query.error.message}
        </p>
      )}
      <ul className="plain-list">
        {query.data?.map((block) => (
          <li key={block.id}>
            <div>
              <strong>{block.reason}</strong>
              <p className="small muted">{dateTime(block.starts_at)}</p>
            </div>
            <button
              className="btn-text"
              type="button"
              aria-label={`Quitar bloqueo: ${block.reason}`}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ id: block.id })}
            >
              <Trash2 size={17} />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function AdminTools() {
  const [day, setDay] = useState(today);
  const [court, setCourt] = useState<number | null>(null);
  const [bookingCourt, setBookingCourt] = useState("");
  const courts = useQuery({
    queryKey: ["courts"],
    queryFn: () => api<Court[]>("/admin/courts"),
  });
  const bookings = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: () => api<Booking[]>("/admin/bookings"),
    refetchInterval: 30000,
  });
  const selectedCourtId = courts.data?.find((item) => item.name === bookingCourt)?.id;
  const occupancy = useQuery({
    queryKey: ["occupancy", day, selectedCourtId],
    enabled: Boolean(day) && (!bookingCourt || selectedCourtId !== undefined),
    refetchInterval: 30000,
    queryFn: () => api<{ scheduled: number; blocked: number; bookable: number; occupied: number; percentage: number | null }>(
      `/admin/occupancy?day=${day}${selectedCourtId === undefined ? "" : `&court_id=${selectedCourtId}`}`,
    ),
  });
  const courtId = court ?? courts.data?.[0]?.id;
  const visible = (bookings.data ?? []).filter(
    (booking) =>
      (!day || dateKey(booking.starts_at) === day) &&
      (!bookingCourt || booking.court === bookingCourt),
  );
  const confirmed = visible.filter(
    (booking) => booking.status === "confirmed",
  ).length;
  const confirmedAmount = visible.reduce(
    (total, booking) =>
      total + (booking.status === "confirmed" ? booking.price : 0),
    0,
  );
  return (
    <div className="admin-stack">
      <section className="panel">
        <h2>
          <CalendarDays size={20} /> Calendario de reservas
        </h2>
        <div className="two-columns admin-calendar-filters">
          <label>
            Ver fecha
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
          <label>
            Filtrar por cancha
            <select
              value={bookingCourt}
              onChange={(e) => setBookingCourt(e.target.value)}
            >
              <option value="">Todas las canchas</option>
              {courts.data?.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {bookings.isPending ? (
          <p>Cargando calendario…</p>
        ) : bookings.error ? (
          <p role="alert" className="error">
            {bookings.error.message}
          </p>
        ) : (
          <>
            <dl className="calendar-summary">
              <div>
                <dt>Confirmadas</dt>
                <dd>{confirmed}</dd>
              </div>
              <div>
                <dt>Canceladas</dt>
                <dd>{visible.length - confirmed}</dd>
              </div>
              <div>
                <dt>Monto reservado</dt>
                <dd>{price(confirmedAmount)}</dd>
              </div>
            </dl>
            {occupancy.isFetching && !occupancy.data && <p>Cargando ocupación…</p>}
            {occupancy.error && <p role="alert" className="error">No se pudo cargar la ocupación: {occupancy.error.message}</p>}
            {occupancy.data && <p>
              Ocupación: {occupancy.data.percentage === null ? "sin turnos reservables" : `${occupancy.data.percentage}%`}
              {` (${occupancy.data.occupied} de ${occupancy.data.bookable} turnos; ${occupancy.data.blocked} bloqueados).`}
              {" "}Calculada con el horario configurado actualmente; los cambios de horario pueden modificar el cálculo de fechas anteriores.
            </p>}
            <BookingList admin bookings={visible} />
          </>
        )}
      </section>
      {courts.error && (
        <p role="alert" className="error">
          {courts.error.message}
        </p>
      )}
      <div className="admin-grid">
        <ManageServices courts={courts.data ?? []} />
        <section className="panel admin-stack">
          <h2>Disponibilidad</h2>
          <label>
            Cancha
            <select
              value={courtId ?? ""}
              onChange={(e) => setCourt(Number(e.target.value))}
            >
              {courts.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {courtId && (
            <>
              <ManageSchedule key={courtId} courtId={courtId} />
              <ManageBlocks key={`blocks-${courtId}`} courtId={courtId} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export function AdminPage() {
  const session = useQuery({ queryKey: ["account"], queryFn: account });
  return (
    <main className="container section">
      <p className="eyebrow">Centro deportivo</p>
      <h1>Administración</h1>
      {session.isPending ? (
        <p>Cargando sesión…</p>
      ) : session.error ? (
        <p role="alert" className="error">
          {session.error.message}
        </p>
      ) : session.data?.role === "admin" ? (
        <AdminTools />
      ) : (
        <p>
          Acceso de administración. <Link to="/ingresar">Iniciar sesión</Link>
        </p>
      )}
    </main>
  );
}
