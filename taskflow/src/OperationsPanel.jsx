import { useState } from "react";
import { useLiveRefresh } from "./live.js";

export function OperationsPanel({api,openBoard,revision}) {
  const [data,setData]=useState(null);
  const [error,setError]=useState("");
  const [manual,setManual]=useState(0);
  const [busy,setBusy]=useState(false);
  useLiveRefresh(true,async signal=>{
    try {const result=await api.request('/operations',{signal});if(!signal.aborted){setData(result.sla?result:null);setError("");}}
    catch(e){if(!signal.aborted)setError(e.message);}
  },[revision,manual]);
  const labels={unconfigured:'Sin SLA',unknown:'Cierre histórico sin fecha',met:'Cumplidos',breached:'Cerrados fuera de SLA',overdue:'Abiertos fuera de SLA',onTrack:'Abiertos dentro de SLA'};
  return <section className="control-panel"><h2>SLA y notificaciones</h2><p>El SLA vence las horas configuradas después de crear la tarjeta. Es independiente de la fecha límite del calendario. Los cierres anteriores a esta función conservan fecha desconocida.</p>
    {error&&<p role="alert">{error}</p>}
    {data&&<><dl>{Object.entries(data.sla).map(([key,value])=><div key={key}><dt>{labels[key]}</dt><dd>{value}</dd></div>)}</dl>
    <h3>Trabajo por responsable</h3><ul>{data.people.map(person=><li key={person.id}>{person.name}: {person.total} tareas · {person.done} cerradas · {person.overdue} con SLA vencido</li>)}</ul>
    <h3>Alertas de SLA ({data.notifications.filter(n=>!n.read).length} sin leer)</h3><p>Notificaciones internas derivadas del estado actual; no se envían correos ni avisos externos. Desaparecen al cerrar la tarea o retirar el SLA.</p>
    {!data.notifications.length&&<p>No hay alertas de SLA.</p>}
    <ul>{data.notifications.map(n=><li key={n.key}><strong>{n.title}</strong> · {n.boardTitle} · vence {new Date(n.deadline).toLocaleString('es-CL')} <button type="button" onClick={()=>openBoard(n.boardId)}>Abrir tablero</button>{n.read?<span>Leída</span>:<button type="button" disabled={busy} onClick={async()=>{setBusy(true);try{await api.request('/notifications/read',{method:'POST',body:{key:n.key}});setManual(v=>v+1);}catch(e){setError(e.message);}finally{setBusy(false);}}}>Marcar como leída</button>}</li>)}</ul></>}
  </section>;
}
