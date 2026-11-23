import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { AuthPage, filterCards } from "./App.jsx";

afterEach(cleanup);

test("una persona nueva puede elegir registro y enviar sus datos", async () => {
  const user = userEvent.setup();
  const signIn = vi.fn().mockResolvedValue(undefined);
  render(<AuthPage signIn={signIn} />);
  await user.click(screen.getByRole("button", { name: "Crear una cuenta" }));
  await user.type(screen.getByLabelText("Nombre"), "Ana Pérez");
  await user.type(screen.getByLabelText("Correo"), "ana@example.cl");
  await user.type(screen.getByLabelText("Contraseña"), "una-clave-larga");
  await user.click(
    screen.getByRole("button", { name: "Crear cuenta", exact: true }),
  );
  expect(signIn).toHaveBeenCalledWith("register", {
    name: "Ana Pérez",
    email: "ana@example.cl",
    password: "una-clave-larga",
  });
});

test("muestra el error comunicado por la API de sesión", async () => {
  const user = userEvent.setup();
  render(
    <AuthPage
      signIn={vi
        .fn()
        .mockRejectedValue(new Error("No se pudo iniciar sesión."))}
    />,
  );
  await user.type(screen.getByLabelText("Correo"), "ana@example.cl");
  await user.type(screen.getByLabelText("Contraseña"), "una-clave-larga");
  await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No se pudo iniciar sesión.",
  );
});

test("filtra texto y prioridad de forma combinada", () => {
  const a = {
    title: "Diseñar",
    description: "Una guía",
    labels: ["Móvil"],
    priority: "HIGH",
  };
  const b = {
    title: "Revisar",
    description: "Probar diseño",
    labels: ["Móvil"],
    priority: "LOW",
  };
  expect(filterCards([a, b], "  MÓVIL ", "HIGH")).toEqual([a]);
  expect(filterCards([a, b], "Revisar", "")).toEqual([b]);
  expect(filterCards([a, b], "oficina", "")).toEqual([]);
});
