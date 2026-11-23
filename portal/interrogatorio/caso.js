const onixSuspects = [
  {
    id: "elena",
    name: "Elena Rojas",
    role: "Administradora del hotel",
    alibi: "Estuve en recepción desde las 21:50. Mi tarjeta de administración estaba conmigo.",
    motive: "Valdés pidió revisar algunos reembolsos. Era una auditoría de rutina.",
    evidence: {
      access: "La tarjeta A-17 es mía y abre esa puerta. No la presté esa noche.",
      audit: "Mi firma está en el informe, pero el importe se podía aclarar al día siguiente.",
    },
    admission: "Entré a la biblioteca a las 22:02 para recuperar el informe. Mentí sobre haber estado todo el tiempo en recepción.",
  },
  {
    id: "tomas",
    name: "Tomás Vidal",
    role: "Abogado del hotel",
    alibi: "Atendí una llamada en el mostrador. El guardia anotó mi nombre cuando me prestó el teléfono.",
    motive: "Valdés podía consultarme sobre el informe, pero no teníamos una reunión programada.",
    evidence: {
      watch: "La llamada está anotada a las 22:02. Le pregunté al guardia la hora cuando colgué.",
    },
  },
  {
    id: "clara",
    name: "Clara Fuentes",
    role: "Periodista invitada",
    alibi: "Estaba presentando la transmisión del evento en el salón. Las cámaras estaban encendidas.",
    motive: "Quería una entrevista sobre los trabajos de restauración. No conocía el informe de cuentas.",
    evidence: {
      watch: "La grabación del evento muestra mi presentación a la hora que anotó el guardia.",
    },
  },
];

const onixEvidence = [
  {
    id: "access",
    title: "Registro de acceso",
    detail: "A las 22:02 la puerta interna se abrió con la tarjeta de administración A-17. La puerta lateral permaneció cerrada.",
  },
  {
    id: "audit",
    title: "Informe de auditoría",
    detail: "Valdés había encontrado reembolsos fuera de norma. Las aprobaciones en el informe llevan la firma de Elena Rojas.",
  },
  {
    id: "watch",
    title: "Libro de guardia",
    detail: "A las 22:02 el guardia anotó que Tomás atendía una llamada en recepción. El video del evento sitúa a Clara en el salón a la misma hora.",
  },
];

const cases = {
  onix: {
    title: "El silencio del Ónix",
    brief: "A las 22:10 encuentran sin vida al auditor Adrián Valdés en la biblioteca del Hotel Ónix. Había citado a alguien para revisar un informe.",
    suspects: onixSuspects, evidence: onixEvidence, culprit: "elena", keyEvidence: ["access", "audit"],
    solution: "La tarjeta A-17 era de Elena y abrió la biblioteca a las 22:02. El informe explica su motivo y el libro de guardia respalda las coartadas de Tomás y Clara."
  },
  galeria: {
    title: "La última exposición",
    brief: "A las 20:15 desapareció la pintura La Aurora de la galería. La sala estaba cerrada al público y solo tres personas permanecían en el edificio.",
    culprit: "mateo", keyEvidence: ["door", "invoice"],
    solution: "La puerta de carga se abrió con la tarjeta de Mateo a las 20:15. La factura demuestra que había contratado un transporte para esa noche; la cámara y el registro de caja respaldan a Lucía y a Sara.",
    suspects: [
      {id:"lucia", name:"Lucía Vera", role:"Curadora", alibi:"A las 20:15 estaba hablando por videollamada desde el despacho. La cámara del pasillo me muestra entrando y saliendo.", motive:"Preparaba la inauguración. La pintura era esencial para la muestra.", evidence:{door:"No tengo tarjeta para la puerta de carga.", camera:"El registro del pasillo puede confirmar mi coartada."}},
      {id:"mateo", name:"Mateo Cruz", role:"Encargado de montaje", alibi:"Estaba recogiendo herramientas en el taller; no salí hacia la puerta de carga.", motive:"Estaba molesto por un pago pendiente, pero jamás dañaría la exposición.", evidence:{door:"Mi tarjeta abre la puerta de carga, pero debe haber un error en el registro.", invoice:"La factura del transporte está a mi nombre. Quería llevar algo fuera del edificio."}, admission:"Abrí la puerta de carga y retiré La Aurora. Pensaba venderla para cubrir mis deudas."},
      {id:"sara", name:"Sara Méndez", role:"Recepcionista", alibi:"Cerré la caja entre las 20:10 y las 20:20; el sistema registra cada operación.", motive:"Admiraba la pintura, pero no tenía forma de abrir la sala.", evidence:{camera:"Mi cierre de caja deja constancia de dónde estaba."}}
    ],
    evidence: [
      {id:"door", title:"Registro de la puerta", detail:"La puerta de carga se abrió a las 20:15 con una tarjeta asignada al encargado de montaje."},
      {id:"invoice", title:"Factura de transporte", detail:"Mateo contrató una furgoneta para recoger un paquete en la puerta de carga esa noche."},
      {id:"camera", title:"Cámara y caja", detail:"La cámara sitúa a Lucía en el despacho; las operaciones de caja sitúan a Sara en recepción a las 20:15."}
    ]
  }
};
const byId = (id) => document.getElementById(id);
const clues = byId("case-clues");
const evidenceCount = byId("evidence-count");
const suspectSelect = byId("interview-suspect");
const suspectRole = byId("interview-role");
const questionForm = byId("interview-form");
const questionSelect = byId("interview-question");
const evidenceForm = byId("evidence-form");
const evidenceSelect = byId("interview-evidence");
const evidenceSubmit = evidenceForm.querySelector("button");
const log = byId("interview-log");
const logEmpty = byId("interview-empty");
const status = byId("case-status");
const accusationPanel = byId("accusation-panel");
const accusationHint = byId("accusation-hint");
const accusationForm = byId("accusation-form");
const accusationSelect = byId("accusation-suspect");
const accusationSubmit = accusationForm.querySelector("button");
const verdict = byId("case-verdict");
const verdictTitle = byId("case-verdict-title");
let activeCase;
let examined;
let presented;
let questions;
let finished;

function currentSuspect() { return activeCase.suspects.find(({id}) => id === suspectSelect.value); }
function updateEvidence() {
  const previous = evidenceSelect.value;
  evidenceCount.textContent = `${examined.size} de ${activeCase.evidence.length} revisadas`;
  evidenceSelect.replaceChildren(new Option(examined.size ? "Elige una prueba" : "Revisa una prueba primero", ""));
  for (const clue of activeCase.evidence) if (examined.has(clue.id)) evidenceSelect.add(new Option(clue.title, clue.id));
  evidenceSelect.value = examined.has(previous) ? previous : "";
  updateEvidenceAction(); updateAccusation();
}
function updateEvidenceAction() {
  const shown = presented.get(suspectSelect.value);
  for (const option of evidenceSelect.options) option.disabled = shown.has(option.value);
  if (shown.has(evidenceSelect.value)) evidenceSelect.value = "";
  evidenceSubmit.disabled = finished || !examined.has(evidenceSelect.value);
}
function updateAccusation() {
  const ready = examined.size >= 2 && questions > 0;
  accusationHint.textContent = ready ? "Ya puedes acusar. Puedes seguir investigando antes de decidir." : "Revisa dos pruebas y haz al menos una pregunta antes de acusar.";
  accusationSubmit.disabled = finished || !ready;
}
function addTestimony(suspect, prompt, answer) {
  const item = document.createElement("li"), name = document.createElement("strong"), label = document.createElement("span"), quote = document.createElement("p");
  name.textContent = suspect.name; label.textContent = prompt; quote.textContent = answer;
  item.append(name, label, quote); log.prepend(item); logEmpty.hidden = true;
  status.textContent = `${suspect.name} respondió. ${answer}`;
}
function updateSuspect() { suspectRole.textContent = currentSuspect().role; updateEvidenceAction(); }
suspectSelect.addEventListener("change", updateSuspect);
evidenceSelect.addEventListener("change", updateEvidenceAction);
questionForm.addEventListener("submit", (event) => {
  event.preventDefault(); if (finished) return;
  const suspect = currentSuspect(), question = questionSelect.selectedOptions[0];
  questions++; addTestimony(suspect, question.textContent, suspect[question.value]); updateAccusation();
});
evidenceForm.addEventListener("submit", (event) => {
  event.preventDefault(); const suspect = currentSuspect();
  const clue = activeCase.evidence.find(({id}) => id === evidenceSelect.value), shown = presented.get(suspect.id);
  if (finished || !clue || !examined.has(clue.id) || shown.has(clue.id)) return;
  shown.add(clue.id);
  const answer = suspect.admission && activeCase.keyEvidence.every((id) => shown.has(id)) ? suspect.admission : suspect.evidence[clue.id] ?? "Esa prueba no coincide con lo que vi esa noche.";
  addTestimony(suspect, `Prueba presentada: ${clue.title}`, answer); updateEvidenceAction();
});
accusationForm.addEventListener("submit", (event) => {
  event.preventDefault(); if (finished || accusationSubmit.disabled) return;
  const accused = activeCase.suspects.find(({id}) => id === accusationSelect.value); if (!accused) return;
  const responsible = activeCase.suspects.find(({id}) => id === activeCase.culprit);
  finished = true; const correct = accused.id === activeCase.culprit;
  verdictTitle.textContent = correct ? "Caso resuelto" : "La acusación no coincide";
  byId("case-verdict-notice").textContent = correct ? `${responsible.name} era responsable.` : `Acusaste a ${accused.name}. Las pruebas apuntaban a ${responsible.name}.`;
  byId("case-verdict-reason").textContent = activeCase.solution;
  status.textContent = ""; accusationPanel.hidden = true; questionForm.querySelector("button").disabled = true;
  updateEvidenceAction(); verdict.hidden = false; verdictTitle.focus();
});
function reset() {
  activeCase = cases[byId("case-choice").value]; examined = new Set();
  presented = new Map(activeCase.suspects.map(({id}) => [id, new Set()])); questions = 0; finished = false;
  byId("case-brief").textContent = `${activeCase.title}: ${activeCase.brief}`;
  clues.replaceChildren(); suspectSelect.replaceChildren(); accusationSelect.replaceChildren(new Option("Elige un sospechoso", ""));
  for (const clue of activeCase.evidence) {
    const card = document.createElement("details"), heading = document.createElement("summary"), description = document.createElement("p");
    card.className = "case-clue"; heading.textContent = clue.title; description.textContent = clue.detail; card.append(heading, description);
    card.addEventListener("toggle", () => { if (finished || !card.open || examined.has(clue.id)) return; examined.add(clue.id); card.dataset.examined = "true"; updateEvidence(); status.textContent = `${clue.title} revisado.`; });
    clues.append(card);
  }
  for (const suspect of activeCase.suspects) { suspectSelect.add(new Option(suspect.name, suspect.id)); accusationSelect.add(new Option(suspect.name, suspect.id)); }
  questionSelect.selectedIndex = 0; byId("detective-notes").value = ""; log.replaceChildren(); logEmpty.hidden = false; accusationPanel.hidden = false; verdict.hidden = true; questionForm.querySelector("button").disabled = false;
  updateSuspect(); updateEvidence(); status.textContent = "Expediente listo para investigar.";
}
byId("case-choice").addEventListener("change", reset);
byId("case-reset").addEventListener("click", reset);
byId("case-retry").addEventListener("click", () => { reset(); clues.querySelector("summary").focus(); });
reset();
