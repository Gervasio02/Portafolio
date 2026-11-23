export type Account = {
  id: number;
  name: string;
  email: string;
  role: "client" | "admin";
};
export type Sport = "futbol" | "padel" | "tenis";
export type ServiceData = {
  court_id: number;
  name: string;
  description: string;
  sport: Sport;
  price: number;
  active: boolean;
};
export type Service = ServiceData & { id: number; court: string };
export type Booking = {
  id: number;
  service_id: number;
  service: string;
  court: string;
  starts_at: string;
  price: number;
  status: "confirmed" | "cancelled";
};
export type SlotStatus = "available" | "booked" | "blocked" | "elapsed";
export type Slot = { hour: number; available: boolean; status: SlotStatus };
export type Availability = { day: string; slots: Slot[] };
export type Court = { id: number; name: string };
export type Schedule = { weekday: number; hours: number[] };
export type Block = { id: number; starts_at: string; reason: string };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  method = "GET",
  data?: object,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    ...(data
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      : {}),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail =
      typeof error.detail === "string"
        ? error.detail
        : Array.isArray(error.detail)
          ? "Revisa los datos ingresados."
          : "No se pudo completar la solicitud.";
    throw new ApiError(detail, response.status);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export async function account() {
  try {
    return await api<Account>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
