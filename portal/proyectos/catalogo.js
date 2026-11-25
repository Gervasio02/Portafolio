"use strict";
const projects = window.PORTFOLIO_PROJECTS;
const $ = (id) => document.getElementById(id);
const normalize = (text) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
for (const [id, values] of [
  ["type", projects.map((p) => p.type)],
  ["technology", projects.flatMap((p) => p.stack)],
]) {
  for (const value of [...new Set(values)].sort()) {
    const option = element("option", value);
    option.value = value;
    $(id).append(option);
  }
}
function render() {
  const query = normalize($("search").value.trim());
  const filtered = projects.filter(
    (p) =>
      (!$("type").value || p.type === $("type").value) &&
      (!$("technology").value || p.stack.includes($("technology").value)) &&
      normalize([p.name, p.goal, ...p.stack].join(" ")).includes(query),
  );
  $("projects").replaceChildren();
  $("count").textContent = `${filtered.length} de ${projects.length} proyectos`;
  for (const p of filtered) {
    const card = element("article", null, "catalog-card");
    card.id = p.id;
    if (p.image) {
      const image = element("img");
      image.src = `../capturas/${p.image}`;
      image.alt = `Vista de ${p.name}`;
      image.loading = "lazy";
      card.append(image);
    }
    const body = element("div", null, "catalog-body");
    body.append(
      element(
        "div",
        `${p.type}${p.featured ? " · Destacado" : ""}`,
        "catalog-meta",
      ),
      element("h2", p.name),
      element("p", p.goal),
      element("p", p.stack.join(" · "), "stack"),
    );
    const actions = element("div", null, "catalog-actions");
    const external = (url) => /^https?:/.test(url);
    const links = [];
    if (p.demo)
      links.push([external(p.demo) ? "Jugar en línea ↗" : "Probar demo", p.demo]);
    if (p.live) links.push(["App en vivo ↗", p.live]);
    links.push([
      "Código",
      `https://github.com/Gervasio02/Portafolio/tree/main/${p.code || p.id}`,
    ]);
    for (const [label, url] of links) {
      const a = element("a", label);
      a.href = url;
      if (external(url)) a.rel = "noopener";
      actions.append(a);
    }
    let note = "Demo en el navegador · datos ficticios";
    if (p.local)
      note = `Se ejecuta en local: inicia el servidor de labs/ y abre ${p.run} (instrucciones en el README).`;
    else if (p.live || external(p.demo || ""))
      note =
        "La app en vivo se apaga cuando nadie la usa: la primera carga puede tardar unos 30 segundos.";
    body.append(actions, element("p", note, "catalog-note"));
    const details = element("details");
    details.append(element("summary", "Objetivo, arquitectura y aprendizajes"));
    for (const [title, text] of [
      ["Funcionalidades", p.features],
      ["Arquitectura", p.architecture],
      ["Aprendizajes", p.learning],
    ])
      details.append(element("h3", title), element("p", text));
    body.append(details);
    card.append(body);
    $("projects").append(card);
  }
  if (!filtered.length)
    $("projects").append(
      element("p", "No hay resultados. Prueba otro filtro.", "catalog-empty"),
    );
  openLinkedProject();
}
function openLinkedProject() {
  const target = document.getElementById(location.hash.slice(1));
  if (target?.classList.contains("catalog-card"))
    target.querySelector("details").open = true;
}
for (const id of ["search", "type", "technology"])
  $(id).addEventListener("input", render);
window.addEventListener("hashchange", openLinkedProject);
render();
