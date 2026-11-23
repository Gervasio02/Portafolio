import { Router } from "express";
import { z } from "zod";
import { fail } from "./http.js";

export function slaState(card, now = new Date()) {
  if (!card.slaDueAt) return "unconfigured";
  if (card.column.position === 2) {
    if (!card.completedAt) return "unknown";
    return card.completedAt <= card.slaDueAt ? "met" : "breached";
  }
  return now > card.slaDueAt ? "overdue" : "onTrack";
}

export function operationsRoutes(db) {
  const router = Router();
  async function snapshot(userId) {
    const now = new Date();
    const cards = await db.card.findMany({
      where: { column: { board: { memberships: { some: { userId } } } } },
      include: { column: { include: { board: { select: { id:true, title:true } } } }, assignee: { select: { id:true, name:true } } },
      orderBy: { id: "asc" },
    });
    const sla = { unconfigured:0, unknown:0, met:0, breached:0, overdue:0, onTrack:0 };
    const people = new Map();
    const notifications = [];
    for (const card of cards) {
      const state = slaState(card, now); sla[state]++;
      const id = card.assigneeId || "unassigned";
      const person = people.get(id) || { id, name:card.assignee?.name || "Sin responsable", total:0, done:0, overdue:0 };
      person.total++; if(card.column.position === 2)person.done++; if(state === "overdue")person.overdue++;
      people.set(id,person);
      // Notifications are derived from current accessible data; no historical dates are invented.
      if (state === "overdue") notifications.push({ key:`${card.id}:${card.slaDueAt.toISOString()}`, cardId:card.id, boardId:card.column.board.id, title:card.title, boardTitle:card.column.board.title, deadline:card.slaDueAt.toISOString() });
    }
    notifications.sort((a,b)=>a.deadline.localeCompare(b.deadline)||a.key.localeCompare(b.key));
    const reads = await db.notificationRead.findMany({ where: { userId, key:{in:notifications.map(n=>n.key)} } });
    const seen = new Set(reads.map(r=>r.key));
    return { asOf:now.toISOString(), sla, people:[...people.values()], notifications:notifications.map(n=>({...n,read:seen.has(n.key)})) };
  }
  router.get("/operations",async(req,res)=>res.set("Cache-Control","private, no-store").json(await snapshot(req.userId)));
  router.post("/notifications/read",async(req,res)=>{
    const { key } = z.object({key:z.string().min(1).max(150)}).parse(req.body);
    const data=await snapshot(req.userId);
    if(!data.notifications.some(n=>n.key===key))fail(404,"Notificación no disponible.");
    await db.notificationRead.upsert({where:{userId_key:{userId:req.userId,key}},create:{userId:req.userId,key},update:{}});
    res.status(204).end();
  });
  return router;
}
