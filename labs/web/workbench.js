"use strict";
const $ = (id) => document.getElementById(id);
const node = (tag, text) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
function table(headers, rows) {
  const wrap = node("div");
  wrap.className = "scroll";
  const t = node("table"),
    head = node("tr");
  headers.forEach((h) => head.append(node("th", h)));
  const thead = node("thead");
  thead.append(head);
  t.append(thead);
  const body = node("tbody");
  rows.forEach((row) => {
    const tr = node("tr");
    row.forEach((v) => tr.append(node("td", v ?? "—")));
    body.append(tr);
  });
  t.append(body);
  wrap.append(t);
  return wrap;
}
function authHeaders(headers = {}) {
  const token = sessionStorage.getItem("labs-access");
  return token ? { ...headers, Authorization: "Bearer " + token } : headers;
}
// Si el servidor está en modo invitado, se pide una sesión temporal y
// aislada la primera vez que hace falta (sin registro ni datos personales).
let guestRequest = null;
async function guestSession() {
  guestRequest ??= fetch("/api/guest", { method: "POST" })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data?.token) sessionStorage.setItem("labs-access", data.token);
      return Boolean(data?.token);
    })
    .catch(() => false)
    .finally(() => (guestRequest = null));
  return guestRequest;
}
async function api(path, options = {}, retry = true) {
  const r = await fetch("/api/" + path, {
    ...options,
    headers: authHeaders(options.headers),
  });
  if (r.status === 401 && retry) {
    sessionStorage.removeItem("labs-access");
    if (await guestSession()) return api(path, options, false);
  }
  const data = await r.json().catch(() => ({
    detail:
      r.status === 401
        ? "Configura la clave de acceso de este laboratorio."
        : "Respuesta no disponible",
  }));
  if (!r.ok)
    throw Error(
      typeof data.detail === "string"
        ? data.detail
        : JSON.stringify(data.detail),
    );
  return data;
}
const json = (data) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
async function perform(action) {
  $("message").textContent = "Procesando…";
  const buttons = [...document.querySelectorAll("button")];
  buttons.forEach((b) => (b.disabled = true));
  try {
    await action();
    $("message").textContent = "Operación completada.";
  } catch (e) {
    $("message").textContent = e.message;
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}
async function datasets() {
  const items = await api("datasets");
  $("datasets").replaceChildren();
  for (const item of items) {
    const b = node("button", `#${item.id} · ${item.name}`);
    b.onclick = () =>
      perform(async () => analysis(await api("datasets/" + item.id)));
    $("datasets").append(b);
  }
}
function analysis(data) {
  const target = $("analysis");
  target.replaceChildren(
    node("h2", "Resultado de limpieza"),
    node(
      "p",
      `${data.report.input_rows} filas de origen · ${data.report.output_rows} filas de salida · ${data.report.duplicates_removed} duplicadas · ${data.report.missing_cells} celdas vacías`,
    ),
  );
  const a = node("a", "Descargar resultado CSV seguro");
  a.href = `/api/datasets/${data.id}/export`;
  target.append(
    a,
    table(
      ["Columna", "Vacíos", "Únicos", "Suma numérica", "Media"],
      data.profile.map((p) => [p.name, p.missing, p.unique, p.sum, p.mean]),
    ),
  );
  for (const p of data.profile) {
    const details = node("details");
    details.append(node("summary", `Distribución de ${p.name}`));
    for (const f of p.frequencies) {
      details.append(node("p", `${f.value || "(vacío)"} · ${f.count}`));
      const meter = node("meter");
      meter.min = 0;
      meter.max = Math.max(1, data.rows.length);
      meter.value = f.count;
      meter.setAttribute("aria-label", `${f.value}: ${f.count}`);
      details.append(meter);
    }
    target.append(details);
  }
  target.append(
    node("h3", "Vista previa · primeras 100 filas"),
    table(data.headers, data.rows.slice(0, 100)),
  );
}
$("upload").onsubmit = (e) => {
  e.preventDefault();
  perform(async () => {
    const f = $("file").files[0];
    if (!f || f.size > 5 * 1024 * 1024)
      throw Error("Selecciona un archivo de hasta 5 MB");
    analysis(
      await api(
        `datasets?filename=${encodeURIComponent(f.name)}&drop_incomplete=${$("drop").checked}`,
        { method: "POST", body: await f.arrayBuffer() },
      ),
    );
    await datasets();
  });
};
$("sample").onclick = () =>
  perform(async () => {
    analysis(
      await api("datasets?filename=ventas-ficticias.csv", {
        method: "POST",
        body: "region,ventas\nCentro,100\nSur,200\nCentro,100\nNorte,\n",
      }),
    );
    await datasets();
  });
const renderAnalysis = analysis;
analysis = (data) => {
  renderAnalysis(data);
  const form = $("query"),
    group = $("query-group"),
    metric = $("query-metric");
  form.hidden = false;
  form.dataset.id = data.id;
  group.replaceChildren();
  metric.replaceChildren();
  const none = node("option", "Sin agrupación");
  none.value = "";
  group.append(none);
  data.headers.forEach((header) => {
    const a = node("option", header),
      b = node("option", header);
    a.value = b.value = header;
    group.append(a);
    metric.append(b);
  });
  $("query-result").replaceChildren();
};
$("query").onsubmit = (e) => {
  e.preventDefault();
  perform(async () => {
    const result = await api(
      `datasets/${e.currentTarget.dataset.id}/query`,
      json({
        group_by: $("query-group").value || null,
        metric: $("query-metric").value || null,
        operation: $("query-operation").value,
        equals: {},
      }),
    );
    $("query-result").replaceChildren(
      node("h3", "Resultado de la consulta"),
      node("p", `${result.filtered_rows} filas analizadas`),
      table(
        ["Grupo", "Valor", "Filas", "Valores numéricos"],
        result.results.map((item) => [
          item.group,
          item.value,
          item.rows,
          item.numeric_values,
        ]),
      ),
    );
  });
};
async function documents() {
  const items = await api("documents");
  $("documents").replaceChildren();
  for (const item of items) {
    const card = node("article");
    card.append(
      node("h3", `Factura #${item.id} · ${item.state}`),
      node(
        "p",
        item.issues.join(" · ") ||
          "Sin inconsistencias deterministas detectadas",
      ),
    );
    const original = node("details");
    original.append(
      node("summary", "Texto original"),
      node("pre", item.source),
    );
    card.append(original);
    if (item.state === "review") {
      const form = node("form"),
        label = node("label", "Campos para revisión humana (JSON)"),
        fields = node("textarea");
      fields.rows = 9;
      fields.value = JSON.stringify(item.fields, null, 2);
      label.append(fields);
      const reasonLabel = node("label", "Motivo de la decisión"),
        reason = node("textarea");
      reason.required = true;
      reason.maxLength = 500;
      reasonLabel.append(reason);
      const selectLabel = node("label", "Decisión"),
        select = node("select");
      for (const [value, title] of [
        ["approved", "Aprobar"],
        ["rejected", "Rechazar"],
      ]) {
        const option = node("option", title);
        option.value = value;
        select.append(option);
      }
      selectLabel.append(select);
      const button = node("button", "Guardar revisión");
      form.append(label, reasonLabel, selectLabel, button);
      form.onsubmit = (e) => {
        e.preventDefault();
        perform(async () => {
          await api(
            `documents/${item.id}/review`,
            json({
              fields: JSON.parse(fields.value),
              decision: select.value,
              reason: reason.value,
            }),
          );
          await documents();
        });
      };
      card.append(form);
    } else {
      card.append(node("pre", JSON.stringify(item.fields, null, 2)));
      const b = node("button", "Consultar auditoría");
      b.onclick = () =>
        perform(async () => {
          const detail = await api(`documents/${item.id}`);
          const p = node("pre", JSON.stringify(detail.decisions, null, 2));
          b.replaceWith(p);
        });
      card.append(b);
    }
    $("documents").append(card);
  }
}
$("invoice").onsubmit = (e) => {
  e.preventDefault();
  perform(async () => {
    await api("documents", json({ text: $("source").value }));
    await documents();
  });
};
$("document-upload").onsubmit = (e) => {
  e.preventDefault();
  perform(async () => {
    const file = $("document-file").files[0];
    if (!file || file.size > 5 * 1024 * 1024)
      throw Error("Selecciona un documento de hasta 5 MB");
    await api(`documents/upload?filename=${encodeURIComponent(file.name)}`, {
      method: "POST",
      body: await file.arrayBuffer(),
    });
    await documents();
  });
};
async function cloudops() {
  const data = await api("cloudops");
  $("services").replaceChildren(node("p", data.note));
  for (const item of data.summary) {
    const observed =
      item.observed_success_percent === null
        ? "Sin muestras"
        : `${item.observed_success_percent}% en ${item.sample_count} muestras`;
    const article = node("article");
    article.append(
      node("h3", item.service),
      node("p", data.services[item.service]),
      node(
        "p",
        `${observed} · Latencia media ${item.average_latency_ms ?? "—"} ms · P95 ${item.p95_latency_ms ?? "—"} ms`,
      ),
    );
    $("services").append(article);
  }
  $("history").replaceChildren(
    table(
      ["Servicio", "Fecha UTC", "Resultado", "Latencia ms", "HTTP"],
      data.history.map((r) => [
        r.service,
        r.checked_at,
        r.success ? "Correcto" : "Fallo o sin respuesta",
        r.latency,
        r.code,
      ]),
    ),
  );
}
$("check").onclick = () =>
  perform(async () => {
    await api("cloudops/check", { method: "POST" });
    await cloudops();
  });
const access = node("details"),
  accessTitle = node("summary", "Acceso al laboratorio"),
  accessForm = node("form"),
  accessLabel = node("label", "Clave de acceso (si el servidor la requiere)"),
  accessInput = node("input");
accessInput.type = "password";
accessInput.autocomplete = "current-password";
accessInput.maxLength = 200;
accessLabel.append(accessInput);
const accessButton = node("button", "Aplicar clave"),
  clearButton = node("button", "Cerrar acceso");
clearButton.type = "button";
clearButton.onclick = () => {
  sessionStorage.removeItem("labs-access");
  accessInput.value = "";
  location.reload();
};
accessForm.append(
  node(
    "p",
    "Usa solo datos ficticios. En producción, cada clave se vincula a una identidad y a sus propios registros.",
  ),
  accessLabel,
  accessButton,
  clearButton,
);
access.append(accessTitle, accessForm);
$("description").after(access);
accessForm.onsubmit = (e) => {
  e.preventDefault();
  if (accessInput.value)
    sessionStorage.setItem("labs-access", accessInput.value);
  accessInput.value = "";
  location.reload();
};
document.addEventListener("click", (e) => {
  const link = e.target.closest("a");
  if (link?.getAttribute("href")?.match(/^\/api\/datasets\/\d+\/export$/)) {
    e.preventDefault();
    perform(async () => {
      const r = await fetch(link.href, { headers: authHeaders() });
      if (!r.ok)
        throw Error("No se pudo exportar. Comprueba la clave de acceso.");
      const url = URL.createObjectURL(await r.blob()),
        download = node("a");
      download.href = url;
      download.download = "resultado.csv";
      download.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
});
async function incidentsAndAlerts() {
  let target = $("incident-manager");
  if (!target) {
    target = node("div");
    target.id = "incident-manager";
    $("cloudops").append(target);
  }
  target.replaceChildren(node("h2", "Incidentes y alertas internas"));
  const [incidents, rules] = await Promise.all([
    api("cloudops/incidents"),
    api("cloudops/alerts"),
  ]);
  target.append(
    node(
      "p",
      "Las alertas crean incidentes en este panel tras un número configurable de comprobaciones fallidas. Solo se evalúan al comprobar servicios; no hay envío de correo ni supervisión en segundo plano.",
    ),
  );
  const alerts = node("div");
  for (const rule of rules) {
    const form = node("form"),
      label = node("label", rule.service),
      enabled = node("input");
    enabled.type = "checkbox";
    enabled.checked = !!rule.enabled;
    label.append(enabled, node("span", " Activar alerta"));
    const thresholdLabel = node(
        "label",
        "Fallos consecutivos para abrir incidente",
      ),
      threshold = node("input");
    threshold.type = "number";
    threshold.min = "1";
    threshold.max = "10";
    threshold.value = rule.consecutive_failures;
    thresholdLabel.append(threshold);
    form.append(label, thresholdLabel, node("button", "Guardar regla"));
    form.onsubmit = (e) => {
      e.preventDefault();
      perform(async () => {
        await api("cloudops/alerts/" + encodeURIComponent(rule.service), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled: enabled.checked,
            consecutive_failures: Number(threshold.value),
          }),
        });
        await incidentsAndAlerts();
      });
    };
    alerts.append(form);
  }
  target.append(alerts);
  const form = node("form"),
    serviceLabel = node("label", "Servicio"),
    service = node("select");
  rules.forEach((rule) => {
    const option = node("option", rule.service);
    option.value = rule.service;
    service.append(option);
  });
  serviceLabel.append(service);
  const descriptionLabel = node("label", "Descripción del incidente observado"),
    description = node("textarea");
  description.required = true;
  description.minLength = 5;
  description.maxLength = 1000;
  descriptionLabel.append(description);
  form.append(
    serviceLabel,
    descriptionLabel,
    node("button", "Registrar incidente"),
  );
  form.onsubmit = (e) => {
    e.preventDefault();
    perform(async () => {
      await api(
        "cloudops/incidents",
        json({ service: service.value, description: description.value }),
      );
      await incidentsAndAlerts();
    });
  };
  target.append(form);
  if (!incidents.length)
    target.append(
      node(
        "p",
        "No hay incidentes registrados. Esto no acredita ausencia de fallos.",
      ),
    );
  for (const item of incidents) {
    const article = node("article");
    article.append(
      node(
        "h3",
        `${item.service} · ${item.resolved_at ? "Resuelto" : "Abierto"}`,
      ),
      node("p", item.description),
      node("p", `${item.created_at} · Origen: ${item.source}`),
    );
    if (!item.resolved_at) {
      const button = node("button", "Marcar resuelto");
      button.onclick = () =>
        perform(async () => {
          await api(`cloudops/incidents/${item.id}/resolve`, {
            method: "POST",
          });
          await incidentsAndAlerts();
        });
      article.append(button);
    }
    target.append(article);
  }
}
const existingCloudops = cloudops;
cloudops = async () => {
  await existingCloudops();
  await incidentsAndAlerts();
};
async function identity() {
  try {
    const data = await api("session");
    $("identity").textContent = data.isolated
      ? `Sesión aislada: ${data.owner}`
      : "Sesión local de demostración";
  } catch (error) {
    $("identity").textContent = error.message;
  }
}
const page = location.pathname.split("/")[1];
const titles = {
  datalab: [
    "DataLab",
    "Carga, limpia, perfila y exporta datos tabulares. Cada ejecución conserva el origen y la política aplicada.",
  ],
  docflow: [
    "DocFlow",
    "Extrae campos de facturas ficticias y registra una decisión humana verificable.",
  ],
  cloudops: [
    "CloudOps",
    "Consulta el historial real de comprobaciones de servicios configurados.",
  ],
};
if (titles[page]) {
  $(page).hidden = false;
  $("title").textContent = titles[page][0];
  document.title = titles[page][0] + " · Portafolio";
  $("description").textContent = titles[page][1];
  void identity();
  perform(() =>
    page === "datalab"
      ? datasets()
      : page === "docflow"
        ? documents()
        : cloudops(),
  );
}
