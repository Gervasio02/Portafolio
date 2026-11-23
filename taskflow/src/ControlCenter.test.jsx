import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ControlCenter } from "./ControlCenter.jsx";
vi.mock("./OperationsPanel.jsx", () => ({ OperationsPanel: () => null }));
import { refreshSeconds } from "./live.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const snapshot = (done) => ({
  asOf: "2026-11-22T15:00:00.000Z",
  totals: {
    boards: 1,
    cards: 1,
    overdue: done ? 0 : 1,
    dueToday: 0,
    progress: done ? 100 : 0,
  },
  status: { todo: done ? 0 : 1, doing: 0, done },
  priority: { high: 1, medium: 0, low: 0 },
  boards: [
    {
      id: "board-1",
      title: "Entrega del equipo",
      objective: "Resolver incidencias",
      role: "VIEWER",
      total: 1,
      done,
      progress: done ? 100 : 0,
      columns: [
        { id: "todo", name: "Por hacer", count: done ? 0 : 1 },
        { id: "done", name: "Hecho", count: done },
      ],
    },
  ],
  overdueCards: done
    ? []
    : [
        {
          id: "card-1",
          title: "Incidencia de acceso",
          boardId: "board-1",
          boardTitle: "Entrega del equipo",
          columnTitle: "Por hacer",
          dueAt: "2026-11-15",
          priority: "HIGH",
        },
      ],
});

test("shows live aggregate updates without a navigation or a manual refresh", async () => {
  vi.useFakeTimers();
  const request = vi
    .fn()
    .mockResolvedValueOnce(snapshot(0))
    .mockResolvedValue(snapshot(1));
  render(
    <ControlCenter
      api={{ request }}
      openBoard={vi.fn()}
      createBoard={vi.fn()}
      revision={0}
    />,
  );
  await act(async () => {});
  expect(screen.getByText("Incidencia de acceso")).toBeVisible();
  expect(
    screen.getByRole("progressbar", { name: "Avance de Entrega del equipo" }),
  ).toHaveValue(0);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(refreshSeconds * 1000);
  });
  expect(screen.queryByText("Incidencia de acceso")).not.toBeInTheDocument();
  expect(
    screen.getByRole("progressbar", { name: "Avance de Entrega del equipo" }),
  ).toHaveValue(100);
  expect(request).toHaveBeenCalledTimes(2);
});

test("lets a reader navigate to the dashboard board and recover after a failed refresh", async () => {
  const user = userEvent.setup();
  const request = vi
    .fn()
    .mockResolvedValueOnce(snapshot(0))
    .mockRejectedValueOnce(new Error("Sin conexión"))
    .mockResolvedValue(snapshot(1));
  const openBoard = vi.fn();
  render(
    <ControlCenter
      api={{ request }}
      openBoard={openBoard}
      createBoard={vi.fn()}
      revision={0}
    />,
  );
  await user.click(
    await screen.findByRole("button", { name: "Abrir tablero", exact: true }),
  );
  expect(openBoard).toHaveBeenCalledWith("board-1");
  await user.click(
    screen.getByRole("button", { name: "Actualizar", exact: true }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "últimos datos disponibles",
  );
  expect(screen.getByText("Incidencia de acceso")).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Actualizar", exact: true }),
  );
  expect(
    await screen.findByText("No hay tarjetas abiertas con fecha vencida."),
  ).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
