import "@testing-library/jest-dom/vitest";
import { render,screen,cleanup,waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach,test,expect,vi } from "vitest";
import { OperationsPanel } from "./OperationsPanel.jsx";
afterEach(cleanup);
test('SLA panel shows real states and persists notification acknowledgement',async()=>{
  let read=false;
  const api={request:vi.fn(async(path)=>{
    if(path==='/notifications/read'){read=true;return null;}
    return {sla:{overdue:1,met:2},people:[{id:'u',name:'Ana',total:3,done:2,overdue:1}],notifications:[{key:'k',title:'Entrega urgente',boardTitle:'Operación',boardId:'b',deadline:'2026-11-23T12:00:00Z',read}]};
  })};
  const open=vi.fn();render(<OperationsPanel api={api} openBoard={open} revision={0}/>);
  await screen.findByText('Entrega urgente');
  await userEvent.click(screen.getByRole('button',{name:'Abrir tablero'}));expect(open).toHaveBeenCalledWith('b');
  await userEvent.click(screen.getByRole('button',{name:'Marcar como leída'}));
  await waitFor(()=>expect(screen.getByText('Leída')).toBeVisible());
  expect(api.request).toHaveBeenCalledWith('/notifications/read',{method:'POST',body:{key:'k'}});
});
test('SLA panel reports a failed request',async()=>{
  render(<OperationsPanel api={{request:vi.fn().mockRejectedValue(new Error('Sin conexión'))}} openBoard={()=>{}} revision={0}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
});
