import type { Sport } from "./api";

export const SPORTS: Record<Sport, string> = {
  futbol: "Fútbol",
  padel: "Pádel",
  tenis: "Tenis",
};
export const WEEKDAYS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
const zone = "America/Santiago";
const dayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: zone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const dateKey = (iso: string) => dayKey.format(new Date(iso));
export const today = () => dayKey.format(new Date());
export const shiftDate = (date: string, days: number) => {
  const utc = new Date(`${date}T12:00:00Z`);
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
};
export const dateLabel = (day: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("es-CL", { ...options, timeZone: zone }).format(
    new Date(`${day}T12:00:00Z`),
  );
export const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("es-CL", {
    timeZone: zone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
export const price = (amount: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
export const hourLabel = (hour: number) =>
  `${String(hour).padStart(2, "0")}:00`;
