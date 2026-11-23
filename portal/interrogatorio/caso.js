const suspects = [
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

const evidence = [
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

const clueTemplate = document.createDocumentFragment();
for (const clue of evidence) {
  const card = document.createElement("details");
  const heading = document.createElement("summary");
  const description = document.createElement("p");
  card.className = "case-clue";
  heading.textContent = clue.title;
  description.textContent = clue.detail;
  card.append(heading, description);
  card.addEventListener("toggle", () => {
    if (finished || !card.open || examined.has(clue.id)) return;
    examined.add(clue.id);
    card.dataset.examined = "true";
    updateEvidence();
    status.textContent = `${clue.title} revisado.`;
  });
  clueTemplate.append(card);
}
clues.append(clueTemplate);

for (const suspect of suspects) {
  suspectSelect.add(new Option(suspect.name, suspect.id));
  accusationSelect.add(new Option(suspect.name, suspect.id));
}

const examined = new Set();
const presented = new Map(suspects.map(({ id }) => [id, new Set()]));
let questions = 0;
let finished = false;

function currentSuspect() {
  return suspects.find(({ id }) => id === suspectSelect.value);
}

function updateEvidence() {
  const selectedEvidence = evidenceSelect.value;
  evidenceCount.textContent = `${examined.size} de ${evidence.length} revisadas`;
  evidenceSelect.replaceChildren(new Option(examined.size ? "Elige una prueba" : "Revisa una prueba primero", ""));
  for (const clue of evidence) {
    if (examined.has(clue.id)) evidenceSelect.add(new Option(clue.title, clue.id));
  }
  evidenceSelect.value = selectedEvidence && examined.has(selectedEvidence) ? selectedEvidence : "";
  updateEvidenceAction();
  updateAccusation();
}

function updateEvidenceAction() {
  const shown = presented.get(suspectSelect.value);
  for (const option of evidenceSelect.options) option.disabled = shown.has(option.value);
  if (shown.has(evidenceSelect.value)) evidenceSelect.value = "";
  evidenceSubmit.disabled = finished || !examined.has(evidenceSelect.value);
}

function updateAccusation() {
  const ready = examined.size >= 2 && questions > 0;
  accusationHint.textContent = ready
    ? "Ya puedes acusar. Puedes seguir investigando antes de decidir."
    : "Revisa dos pruebas y haz al menos una pregunta antes de acusar.";
  accusationSubmit.disabled = finished || !ready;
}

function addTestimony(suspect, prompt, answer) {
  const transcript = document.createElement("li");
  const heading = document.createElement("strong");
  const label = document.createElement("span");
  const quote = document.createElement("p");
  heading.textContent = suspect.name;
  label.textContent = prompt;
  quote.textContent = answer;
  transcript.append(heading, label, quote);
  log.prepend(transcript);
  logEmpty.hidden = true;
  status.textContent = `${suspect.name} respondió. ${answer}`;
}

function updateSuspect() {
  suspectRole.textContent = currentSuspect().role;
  updateEvidenceAction();
}

suspectSelect.addEventListener("change", updateSuspect);
evidenceSelect.addEventListener("change", updateEvidenceAction);

questionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (finished) return;
  const suspect = currentSuspect();
  const question = questionSelect.selectedOptions[0];
  questions++;
  addTestimony(suspect, question.textContent, suspect[question.value]);
  updateAccusation();
});

evidenceForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const suspect = currentSuspect();
  const clue = evidence.find(({ id }) => id === evidenceSelect.value);
  const shown = presented.get(suspect.id);
  if (finished || !clue || !examined.has(clue.id) || shown.has(clue.id)) return;
  shown.add(clue.id);
  const answer = suspect.admission && shown.has("access") && shown.has("audit")
    ? suspect.admission
    : suspect.evidence[clue.id] ?? "Esa prueba no coincide con lo que vi esa noche.";
  addTestimony(suspect, `Prueba presentada: ${clue.title}`, answer);
  updateEvidenceAction();
  if (evidenceSubmit.disabled) evidenceSelect.focus();
});

accusationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (finished || accusationSubmit.disabled) return;

  const accused = suspects.find(({ id }) => id === accusationSelect.value);
  if (!accused) return;

  finished = true;
  const correct = accused.id === "elena";
  verdictTitle.textContent = correct ? "Caso resuelto" : "La acusación no coincide";
  byId("case-verdict-notice").textContent = correct
    ? "Elena Rojas era la responsable."
    : `Acusaste a ${accused.name}. Las pruebas apuntaban a Elena Rojas.`;
  byId("case-verdict-reason").textContent = "La tarjeta A-17 era de Elena y abrió la biblioteca a las 22:02. El informe explica su motivo y el libro de guardia respalda las coartadas de Tomás y Clara.";
  status.textContent = "";
  accusationPanel.hidden = true;
  questionForm.querySelector("button").disabled = true;
  updateEvidenceAction();
  verdict.hidden = false;
  verdictTitle.focus();
});

function reset() {
  finished = false;
  examined.clear();
  for (const shown of presented.values()) shown.clear();
  questions = 0;
  suspectSelect.selectedIndex = 0;
  questionSelect.selectedIndex = 0;
  accusationSelect.selectedIndex = 0;
  for (const card of clues.children) {
    card.open = false;
    delete card.dataset.examined;
  }
  log.replaceChildren();
  logEmpty.hidden = false;
  accusationPanel.hidden = false;
  verdict.hidden = true;
  questionForm.querySelector("button").disabled = false;
  updateSuspect();
  updateEvidence();
  status.textContent = "Expediente reiniciado.";
}

byId("case-reset").addEventListener("click", reset);
byId("case-retry").addEventListener("click", () => {
  reset();
  clues.querySelector("summary").focus();
});
updateSuspect();
updateEvidence();
