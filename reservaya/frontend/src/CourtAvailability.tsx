import { CircleCheck, CircleDot, Clock3 } from "lucide-react";
import type { Service, Slot, SlotStatus } from "./api";
import { hourLabel, SPORTS } from "./format";

const details = {
  futbol: { format: "5 contra 5", zones: "Arcos y áreas" },
  padel: { format: "Dobles", zones: "Red y cuadros de saque" },
  tenis: { format: "Individual o dobles", zones: "Red, saque y pasillos" },
};

export const SLOT_LABEL: Record<SlotStatus, string> = {
  available: "Libre",
  booked: "Reservado",
  blocked: "Bloqueado",
  elapsed: "Pasó",
};

export function CourtAvailability({
  service,
  slots,
  selected,
  confirmed,
  onSelect,
}: {
  service: Service;
  slots: Slot[] | undefined;
  selected: Slot | undefined;
  confirmed: boolean;
  onSelect: (hour: number) => void;
}) {
  const detail = details[service.sport];
  const free = slots?.filter((slot) => slot.available).length ?? 0;
  const next = slots?.find((slot) => slot.available);
  const upcoming = slots?.filter((slot) => slot.status !== "elapsed") ?? [];
  const state = confirmed
    ? "confirmed"
    : selected?.available
      ? "selected"
      : free > 0
        ? "open"
        : "closed";
  return (
    <figure
      className={`court-preview court-${service.sport}`}
      data-state={state}
    >
      <figcaption className="court-caption">
        <div>
          <span className="court-sport">
            {SPORTS[service.sport]} · {detail.format}
          </span>
          <strong>{service.court}</strong>
        </div>
        <span className="court-map-note">{detail.zones}</span>
      </figcaption>
      <div className="court-illustration" aria-hidden="true">
        <div className="court-pitch">
          <span className="court-net" />
          {service.sport === "futbol" ? (
            <>
              <span className="court-circle" />
              <span className="court-goal first" />
              <span className="court-goal second" />
            </>
          ) : (
            <>
              <span className="court-service-box" />
              <span className="court-service-line" />
            </>
          )}
          <span className="court-focus" />
        </div>
      </div>
      {slots !== undefined && (
        <div className="court-board">
          <span className="court-board-reading" role="status">
            {confirmed ? (
              <>
                <CircleCheck size={16} aria-hidden="true" /> Reserva confirmada
              </>
            ) : selected?.available ? (
              <>
                <CircleDot size={16} aria-hidden="true" />{" "}
                {hourLabel(selected.hour)}–{hourLabel(selected.hour + 1)} ·
                Seleccionado
              </>
            ) : next ? (
              <>
                <Clock3 size={16} aria-hidden="true" /> Próximo turno:{" "}
                {hourLabel(next.hour)}
              </>
            ) : (
              <>
                <Clock3 size={16} aria-hidden="true" /> Sin turnos libres
              </>
            )}
          </span>
          <div className="court-actions">
            {upcoming.length > 0 && (
              <span className="court-capacity">
                {free} de {upcoming.length} turnos libres
              </span>
            )}
            {!confirmed && !selected?.available && next && (
              <button
                type="button"
                className="court-next"
                onClick={() => onSelect(next.hour)}
              >
                Elegir {hourLabel(next.hour)}
              </button>
            )}
          </div>
        </div>
      )}
    </figure>
  );
}
