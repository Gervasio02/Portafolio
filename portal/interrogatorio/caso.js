const onixSuspects = [
  {
    id: "elena",
    name: "Elena Rojas",
    role: "Administradora del hotel",
    alibi: "Estuve en recepci�n desde las 21:50. Mi tarjeta de administraci�n estaba conmigo.",
    motive: "Vald�s pidi� revisar algunos reembolsos. Era una auditor�a de rutina.",
    evidence: {
      access: "La tarjeta A-17 es m�a y abre esa puerta. No la prest� esa noche.",
      audit: "Mi firma est� en el informe, pero el importe se pod�a aclarar al d�a siguiente.",
    },
    admission: "Entr� a la biblioteca a las 22:02 para recuperar el informe. Ment� sobre haber estado todo el tiempo en recepci�n.",
  },
  {
    id: "tomas",
    name: "Tom�s Vidal",
    role: "Abogado del hotel",
    alibi: "Atend� una llamada en el mostrador. El guardia anot� mi nombre cuando me prest� el tel�fono.",
    motive: "Vald�s pod�a consultarme sobre el informe, pero no ten�amos una reuni�n programada.",
    evidence: {
      watch: "La llamada est� anotada a las 22:02. Le pregunt� al guardia la hora cuando colgu�.",
    },
  },
  {
    id: "clara",
    name: "Clara Fuentes",
    role: "Periodista invitada",
    alibi: "Estaba presentando la transmisi�n del evento en el sal�n. Las c�maras estaban encendidas.",
    motive: "Quer�a una entrevista sobre los trabajos de restauraci�n. No conoc�a el informe de cuentas.",
    evidence: {
      watch: "La grabaci�n del evento muestra mi presentaci�n a la hora que anot� el guardia.",
    },
  },
];

const onixEvidence = [
  {
    id: "access",
    title: "Registro de acceso",
    detail: "A las 22:02 la puerta interna se abri� con la tarjeta de administraci�n A-17. La puerta lateral permaneci� cerrada.",
  },
  {
    id: "audit",
    title: "Informe de auditor�a",
    detail: "Vald�s hab�a encontrado reembolsos fuera de norma. Las aprobaciones en el informe llevan la firma de Elena Rojas.",
  },
  {
    id: "watch",
    title: "Libro de guardia",
    detail: "A las 22:02 el guardia anot� que Tom�s atend�a una llamada en recepci�n. El video del evento sit�a a Clara en el sal�n a la misma hora.",
  },
];

const cases = {
  onix: {
    title: "El silencio del �nix",
    brief: "A las 22:10 encuentran sin vida al auditor Adri�n Vald�s en la biblioteca del Hotel �nix. Hab�a citado a alguien para revisar un informe.",
    suspects: onixSuspects, evidence: onixEvidence, culprit: "elena", keyEvidence: ["access", "audit"],
    solution: "La tarjeta A-17 era de Elena y abri� la biblioteca a las 22:02. El informe explica su motivo y el libro de guardia respalda las coartadas de Tom�s y Clara."
  },
  galeria: {
    title: "La �ltima exposici�n",
    brief: "A las 20:15 desapareci� la pintura La Aurora de la galer�a. La sala estaba cerrada al p�blico y solo tres personas permanec�an en el edificio.",
    culprit: "mateo", keyEvidence: ["door", "invoice"],
    solution: "La puerta de carga se abri� con la tarjeta de Mateo a las 20:15. La factura demuestra que hab�a contratado un transporte para esa noche; la c�mara y el registro de caja respaldan a Luc�a y a Sara.",
    suspects: [
      {id:"lucia", name:"Luc�a Vera", role:"Curadora", alibi:"A las 20:15 estaba hablando por videollamada desde el despacho. La c�mara del pasillo me muestra entrando y saliendo.", motive:"Preparaba la inauguraci�n. La pintura era esencial para la muestra.", evidence:{door:"No tengo tarjeta para la puerta de carga.", camera:"El registro del pasillo puede confirmar mi coartada."}},
      {id:"mateo", name:"Mateo Cruz", role:"Encargado de montaje", alibi:"Estaba recogiendo herramientas en el taller; no sal� hacia la puerta de carga.", motive:"Estaba molesto por un pago pendiente, pero jam�s da�ar�a la exposici�n.", evidence:{door:"Mi tarjeta abre la puerta de carga, pero debe haber un error en el registro.", invoice:"La factura del transporte est� a mi nombre. Quer�a llevar algo fuera del edificio."}, admission:"Abr� la puerta de carga y retir� La Aurora. Pensaba venderla para cubrir mis deudas."},
      {id:"sara", name:"Sara M�ndez", role:"Recepcionista", alibi:"Cerr� la caja entre las 20:10 y las 20:20; el sistema registra cada operaci�n.", motive:"Admiraba la pintura, pero no ten�a forma de abrir la sala.", evidence:{camera:"Mi cierre de caja deja constancia de d�nde estaba."}}
    ],
    evidence: [
      {id:"door", title:"Registro de la puerta", detail:"La puerta de carga se abri� a las 20:15 con una tarjeta asignada al encargado de montaje."},
      {id:"invoice", title:"Factura de transporte", detail:"Mateo contrat� una furgoneta para recoger un paquete en la puerta de carga esa noche."},
      {id:"camera", title:"C�mara y caja", detail:"La c�mara sit�a a Luc�a en el despacho; las operaciones de caja sit�an a Sara en recepci�n a las 20:15."}
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
  status.textContent = `${suspect.name} respondi�. ${answer}`;
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
  verdictTitle.textContent = correct ? "Caso resuelto" : "La acusaci�n no coincide";
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
