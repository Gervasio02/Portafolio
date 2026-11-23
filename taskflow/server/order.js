import { fail } from "./http.js";

export function cardOrder(destination, movedId, beforeId) {
  const ids = destination.map(({ id }) => id);
  const index = beforeId ? ids.indexOf(beforeId) : ids.length;
  if (index < 0) fail(400, "La tarjeta de destino ya no está en esa columna.");
  ids.splice(index, 0, movedId);
  return ids.map((id, position) => ({ id, position }));
}
