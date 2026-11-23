import "@testing-library/jest-dom/vitest";
import { render,screen,cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach,test,expect,vi } from "vitest";
import { TaskCalendar } from "./TaskCalendar.jsx";
afterEach(cleanup);
test("calendar shows the selected month and opens a due task",async()=>{
  const open=vi.fn();const due={id:'1',title:'Entrega',dueAt:'2026-11-23T00:00:00Z',priority:'HIGH'};
  render(<TaskCalendar cards={[due,{id:'2',title:'Sin programar'}]} openCard={open} initialMonth="2026-11"/>);
  await userEvent.click(screen.getByRole('button',{name:/Entrega/}));expect(open).toHaveBeenCalledWith(due);
  expect(screen.getByText('Sin fecha límite (1)')).toBeVisible();
  await userEvent.clear(screen.getByLabelText('Mes del calendario'));
  expect(screen.getByRole('button',{name:/Entrega/})).toBeVisible();
});
