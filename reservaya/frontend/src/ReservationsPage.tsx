import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Clock3 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { account, api, type Booking } from "./api";
import { dateTime, price } from "./format";

export function BookingList({
  bookings,
  admin = false,
}: {
  bookings: Booking[];
  admin?: boolean;
}) {
  const cache = useQueryClient();
  const [receiptError, setReceiptError] = useState("");
  const [receiptBusy, setReceiptBusy] = useState(false);
  async function downloadReceipt(id: number) {
    setReceiptBusy(true); setReceiptError("");
    try {
      const data = await api<object>(`/bookings/${id}/receipt`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type:"application/json"}));
      const link = document.createElement("a"); link.href=url; link.download=`reserva-RY-${id}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(error) { setReceiptError(error instanceof Error ? error.message : "No se pudo obtener el comprobante."); }
    finally { setReceiptBusy(false); }
  }
  const cancel = useMutation({
    mutationFn: (id: number) => api<Booking>(`/bookings/${id}`, "DELETE"),
    onSuccess: () =>
      Promise.all([
        cache.invalidateQueries({ queryKey: ["bookings"] }),
        cache.invalidateQueries({ queryKey: ["availability"] }),
        cache.invalidateQueries({ queryKey: ["admin-bookings"] }),
      ]),
  });

  return (
    <>
      {receiptError && <p role="alert" className="error">{receiptError}</p>}
      {cancel.error && (
        <p className="error" role="alert">
          {cancel.error.message}
        </p>
      )}
      {bookings.length === 0 ? (
        <div className="empty">
          <CalendarDays size={32} />
          <h3>Sin reservas</h3>
          {!admin && (
            <Link to="/" className="btn-primary">
              Buscar cancha
            </Link>
          )}
        </div>
      ) : (
        <ul className="booking-list">
          {bookings.map((booking) => (
            <li key={booking.id}>
              <div>
                <h3>{booking.service}</h3>
                <p className="muted">
                  <Clock3 size={15} /> {dateTime(booking.starts_at)}
                </p>
                <p>{price(booking.price)}</p>
              </div>
              <div className="booking-status">
                <button className="btn-text" disabled={receiptBusy} onClick={()=>void downloadReceipt(booking.id)}>Descargar comprobante</button>
                <span className={`status ${booking.status}`}>
                  {booking.status === "confirmed" ? "Confirmada" : "Cancelada"}
                </span>
                {booking.status === "confirmed" &&
                  Date.parse(booking.starts_at) > Date.now() && (
                    <button
                      className="btn-text"
                      disabled={cancel.isPending}
                      onClick={() => {
                        if (window.confirm("¿Cancelar esta reserva?"))
                          cancel.mutate(booking.id);
                      }}
                    >
                      Cancelar
                    </button>
                  )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function ReservationsPage() {
  const session = useQuery({ queryKey: ["account"], queryFn: account });
  const bookings = useQuery({
    queryKey: ["bookings"],
    queryFn: () => api<Booking[]>("/bookings"),
    enabled: Boolean(session.data),
  });
  return (
    <main className="container section">
      <p className="eyebrow">Tu actividad</p>
      <h1>Mis reservas</h1>
      <div className="panel">
        {session.isPending ? (
          <p>Comprobando sesión…</p>
        ) : session.error ? (
          <p role="alert" className="error">
            {session.error.message}
          </p>
        ) : !session.data ? (
          <Link className="btn-primary" to="/ingresar?next=/reservas">
            Inicia sesión para ver tu historial
          </Link>
        ) : bookings.isPending ? (
          <p>Cargando reservas…</p>
        ) : bookings.error ? (
          <p role="alert" className="error">
            {bookings.error.message}
          </p>
        ) : (
          <BookingList bookings={bookings.data ?? []} />
        )}
      </div>
    </main>
  );
}
