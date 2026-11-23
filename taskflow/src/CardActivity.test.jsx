import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, test, expect, vi } from "vitest";
import { CardActivity } from "./App.jsx";
afterEach(cleanup);
test("a reader sees escaped comments without an editor form", async () => {
  const client={request:vi.fn().mockResolvedValue([{id:'1',actor:{name:'Ana'},createdAt:'2026-11-23T12:00:00Z',body:'<script>unsafe</script>'}])};
  render(<CardActivity boardId="b" cardId="c" editable={false} client={client}/>);
  expect(await screen.findByText('<script>unsafe</script>')).toBeVisible();
  expect(screen.queryByLabelText('Nuevo comentario')).not.toBeInTheDocument();
});
test("an editor posts a comment and refreshes activity", async () => {
  const client={request:vi.fn().mockResolvedValue([])};
  render(<CardActivity boardId="b" cardId="c" editable client={client}/>);
  await screen.findByText('Aún no hay actividad.');
  const user=userEvent.setup();
  await user.type(screen.getByLabelText('Nuevo comentario'),'Entrega revisada');
  await user.click(screen.getByRole('button',{name:'Publicar comentario'}));
  expect(client.request).toHaveBeenCalledWith('/boards/b/cards/c/comments',{method:'POST',body:{body:'Entrega revisada'}});
  expect(screen.getByLabelText('Nuevo comentario')).toHaveValue('');
});
