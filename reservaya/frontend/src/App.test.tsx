import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { SlotPicker } from "./BookingPage";

afterEach(() => vi.unstubAllGlobals());

describe("ReservaYa", () => {
  it("permite seleccionar una franja libre y deshabilita las ocupadas", () => {
    const select = vi.fn();
    render(
      <SlotPicker
        selected={null}
        onSelect={select}
        slots={[
          { hour: 8, available: false, status: "blocked" },
          { hour: 9, available: true, status: "available" },
        ]}
      />,
    );
    expect(
      screen.getByRole("button", { name: "08:00 Bloqueado" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "09:00 Libre" }));
    expect(select).toHaveBeenCalledWith(9);
  });

  it("muestra las canchas, deja elegir hora y confirma la reserva", async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url === "/api/auth/me")
        return Response.json({
          id: 1,
          name: "Camila",
          email: "camila@example.com",
          role: "client",
        });
      if (url === "/api/services")
        return Response.json([
          {
            id: 1,
            court_id: 1,
            name: "Cristal",
            description: "Cancha cubierta",
            sport: "padel",
            price: 15000,
            active: true,
            court: "Central",
          },
        ]);
      if (url.startsWith("/api/services/1/availability"))
        return Response.json({
          slots: [{ hour: 18, available: true, status: "available" }],
        });
      if (url === "/api/bookings")
        return Response.json(
          {
            id: 1,
            price: 15000,
            status: "confirmed",
            starts_at: "2027-03-18T21:00:00Z",
          },
          { status: 201 },
        );
      throw new Error(url);
    });
    vi.stubGlobal("fetch", fetch);
    const cache = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={cache}>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("link", { name: "Ver horarios" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Elegir 18:00" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "18:00–19:00 · Seleccionado",
    );
    const confirm = screen.getByRole("button", { name: "Confirmar reserva" });
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);
    expect(
      await screen.findByRole("heading", { name: "Reserva confirmada" }),
    ).toBeVisible();
    expect(fetch).toHaveBeenCalledWith(
      "/api/bookings",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"hour":18'),
      }),
    );
  });
});
