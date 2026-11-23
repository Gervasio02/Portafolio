import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  account,
  api,
  type Availability,
  type Booking,
  type Service,
  type Slot,
} from "./api";
import {
  dateLabel,
  dateTime,
  hourLabel,
  price,
  shiftDate,
  SPORTS,
  today,
} from "./format";
import { AuthForm } from "./AuthForm";
import { CourtAvailability, SLOT_LABEL } from "./CourtAvailability";

export function SlotPicker({
  slots,
  selected,
  onSelect,
  locked = false,
}: {
  slots: Slot[];
  selected: number | null;
  onSelect: (hour: number) => void;
  locked?: boolean;
}) {
  return (
    <div className="slot-grid" aria-label="Horarios">
      {slots.map((slot) => (
        <button
          key={slot.hour}
          className="slot"
          type="button"
          aria-pressed={slot.available && selected === slot.hour}
          data-slot-status={slot.status}
          disabled={locked || !slot.available}
          onClick={() => onSelect(slot.hour)}
        >
          <strong>{hourLabel(slot.hour)}</strong>
          <span>{SLOT_LABEL[slot.status]}</span>
        </button>
      ))}
    </div>
  );
}

export function BookingPage() {
  const { id } = useParams();
  const [day, setDay] = useState(today);
  const [hour, setHour] = useState<number | null>(null);
  const [authVisible, showAuth] = useState(false);
  const cache = useQueryClient();
  const session = useQuery({ queryKey: ["account"], queryFn: account });
  const services = useQuery({
    queryKey: ["services"],
    queryFn: () => api<Service[]>("/services"),
  });
  const service = services.data?.find((item) => String(item.id) === id);
  const availability = useQuery({
    queryKey: ["availability", id, day],
    enabled: Boolean(service),
    refetchInterval: 30000,
    queryFn: () => api<Availability>(`/services/${id}/availability?day=${day}`),
  });
  const booking = useMutation({
    mutationFn: () =>
      api<Booking>("/bookings", "POST", { service_id: Number(id), day, hour }),
    onSettled: () => {
      void cache.invalidateQueries({ queryKey: ["availability", id] });
      void cache.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
  const slots = availability.data?.slots;
  const selected = slots?.find((slot) => slot.hour === hour);
  const min = today();
  const max = shiftDate(min, 60);
  const week = Array.from({ length: 7 }, (_, i) =>
    shiftDate(day >= shiftDate(min, 7) ? day : min, i),
  ).filter((value) => value <= max);

  function changeDay(value: string) {
    if (booking.isPending || value < min || value > max) return;
    setDay(value);
    setHour(null);
    booking.reset();
  }

  function chooseHour(value: number) {
    if (booking.isPending) return;
    setHour(value);
    booking.reset();
  }

  if (!service && services.isPending)
    return <main className="container section">Cargando cancha…</main>;
  if (!service)
    return (
      <main className="container section">
        <p role="alert">{services.error?.message ?? "Cancha no disponible."}</p>
        <Link to="/">Volver a canchas</Link>
      </main>
    );

  return (
    <main className="container section">
      <Link to="/" className="back">
        <ArrowLeft size={16} /> Todas las canchas
      </Link>
      <div className="booking-header">
        <p className="eyebrow">{SPORTS[service.sport]}</p>
        <h1>{service.name}</h1>
        <p className="muted">
          <MapPin size={17} /> {service.court}
        </p>
      </div>
      <div className="booking-layout">
        <section className="panel">
          <h2>
            <CalendarDays size={21} /> Fecha y hora
          </h2>
          <CourtAvailability
            service={service}
            slots={slots}
            selected={selected}
            confirmed={Boolean(booking.data)}
            onSelect={chooseHour}
          />
          <label className="date-input">
            Elige una fecha
            <input
              aria-label="Elige una fecha"
              type="date"
              min={min}
              max={max}
              value={day}
              disabled={booking.isPending}
              onChange={(e) => changeDay(e.target.value)}
            />
          </label>
          <div className="week-strip">
            {week.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={value === day}
                disabled={booking.isPending}
                onClick={() => changeDay(value)}
              >
                <span>{dateLabel(value, { weekday: "short" })}</span>
                <strong>{Number(value.slice(-2))}</strong>
              </button>
            ))}
          </div>
          <h3>Horarios en Santiago</h3>
          <p className="small muted">
            Selecciona un turno libre de 60 minutos.
          </p>
          {availability.isPending && <p>Cargando horarios…</p>}
          {availability.error && (
            <p className="error" role="alert">
              {availability.error.message}
            </p>
          )}
          {slots &&
            (slots.length ? (
              <SlotPicker
                slots={slots}
                locked={booking.isPending}
                selected={hour}
                onSelect={chooseHour}
              />
            ) : (
              <p>No hay horarios publicados para este día.</p>
            ))}
        </section>
        <aside className="panel summary">
          {booking.data ? (
            <div className="form-stack">
              <CheckCircle2 size={34} />
              <h2>Reserva confirmada</h2>
              <p>{dateTime(booking.data.starts_at)}</p>
              <p className="small muted">
                Reserva N.º {booking.data.id} · {price(booking.data.price)}
              </p>
              <Link className="btn-primary" to="/reservas">
                Ver mis reservas
              </Link>
            </div>
          ) : authVisible && !session.data ? (
            <AuthForm done={() => showAuth(false)} />
          ) : (
            <>
              <h2>Tu reserva</h2>
              <p className="muted">{service.name}</p>
              <p>
                <Clock3 size={16} />{" "}
                {hour === null
                  ? "Selecciona un horario"
                  : `${hourLabel(hour)}–${hourLabel(hour + 1)}`}
                {selected && !selected.available && (
                  <span className="small">· {SLOT_LABEL[selected.status]}</span>
                )}
              </p>
              <p>
                {dateLabel(day, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              <div className="total">
                <span>Total</span>
                <strong>{price(service.price)}</strong>
              </div>
              {session.error && (
                <p className="error" role="alert">
                  {session.error.message}
                </p>
              )}
              {booking.error && (
                <p className="error" role="alert">
                  {booking.error.message}
                </p>
              )}
              <button
                className="btn-primary"
                disabled={
                  hour === null ||
                  booking.isPending ||
                  session.isPending ||
                  !selected?.available
                }
                onClick={() =>
                  session.data ? booking.mutate() : showAuth(true)
                }
              >
                {booking.isPending
                  ? "Confirmando…"
                  : session.data
                    ? "Confirmar reserva"
                    : "Continuar"}
              </button>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
