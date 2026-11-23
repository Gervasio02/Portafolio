import { cardOrder } from "../server/order.js";

const destination = Object.freeze([
  Object.freeze({ id: "a" }),
  Object.freeze({ id: "b" }),
]);

test("inserta delante del destino y numera posiciones sin mutar la lista", () => {
  expect(cardOrder(destination, "x", "b")).toEqual([
    { id: "a", position: 0 },
    { id: "x", position: 1 },
    { id: "b", position: 2 },
  ]);
});

test("añade al final o inicia una columna vacía", () => {
  expect(cardOrder(destination, "x").at(-1)).toEqual({ id: "x", position: 2 });
  expect(cardOrder([], "x")).toEqual([{ id: "x", position: 0 }]);
});

test("rechaza reordenar delante de una tarjeta que ya no está en la columna", () => {
  expect(() => cardOrder(destination, "x", "borrada")).toThrow(/ya no está/);
});
