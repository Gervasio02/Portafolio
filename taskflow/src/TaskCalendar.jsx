import { useState } from "react";
import "./calendar.css";

export function TaskCalendar({ cards, openCard, initialMonth }) {
  const today = new Date();
  const [month, setMonth] = useState(initialMonth || `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`);
  const [year, number] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, number-1, 1));
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const offset = (first.getUTCDay()+6)%7;
  const rows = Array.from({length:Math.ceil((offset+count)/7)}, (_,week)=>Array.from({length:7},(_,weekday)=>week*7+weekday-offset+1));
  const title = new Intl.DateTimeFormat("es-CL",{month:"long",year:"numeric",timeZone:"UTC"}).format(first);
  const unplanned = cards.filter(card=>!card.dueAt);
  return <section aria-label="Calendario de tareas" className="task-calendar">
    <label>Mes del calendario<input type="month" value={month} min="1900-01" max="9999-12" onChange={e=>{if (/^[1-9][0-9]{3}-(0[1-9]|1[0-2])$/.test(e.target.value)) setMonth(e.target.value);}} /></label>
    <div className="calendar-scroll"><table><caption>{title}</caption><thead><tr>{["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"].map(day=><th key={day} scope="col">{day}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={index}>{row.map((day,column)=>{
      if(day<1||day>count)return <td key={column}/>;
      const date=`${month}-${String(day).padStart(2,"0")}`;
      const due = cards.filter(card=>card.dueAt?.slice(0,10)===date);
      return <td key={column}><time dateTime={date}>{day}</time>{due.map(card=><button type="button" key={card.id} onClick={()=>openCard(card)}><strong>{card.title}</strong><small>{card.priority === "HIGH" ? "Prioridad alta" : card.priority === "LOW" ? "Prioridad baja" : "Prioridad media"}</small></button>)}</td>;
    })}</tr>)}</tbody></table></div>
    <h3>Sin fecha límite ({unplanned.length})</h3>{unplanned.map(card=><button type="button" key={card.id} onClick={()=>openCard(card)}>{card.title}</button>)}
    <p>Se muestran las tareas que coinciden con los filtros actuales. Selecciona una para consultar o editar sus datos.</p>
  </section>;
}
