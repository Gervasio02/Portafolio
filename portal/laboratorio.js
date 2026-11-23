const body = document.querySelector("#demo-body");
const feedback = document.querySelector("#feedback");
const demos = {
  taskflow: {
    name: "TaskFlow",
    intro: "Supervisa entregas e incidentes. Cambia de tablero o mueve una tarjeta para actualizar el panel al instante.",
    concept: "La API de Express comprueba el rol de cada usuario y guarda el orden de las tarjetas en PostgreSQL.",
    init: () => ({
      selected: "entregas",
      boards: [
        { id: "entregas", name: "Entregas", cards: [
          { id: 1, title: "Preparar entrega del viernes", column: 0 },
          { id: 2, title: "Validar el entorno de pruebas", column: 1 },
          { id: 3, title: "Aprobar alcance de la entrega", column: 2 },
        ] },
        { id: "incidentes", name: "Incidentes", cards: [
          { id: 4, title: "Diagnosticar factura duplicada", column: 0 },
          { id: 5, title: "Revisar tiempos de respuesta", column: 0 },
          { id: 6, title: "Confirmar corrección de inventario", column: 1 },
        ] },
      ],
    }),
    render: renderBoard,
  },
  reservaya: {
    name: "ReservaYa",
    intro: "Elige una cancha y toma un turno de prueba. Los lugares bloqueados no se pueden reservar.",
    concept: "La aplicación FastAPI comprueba bloqueos y horarios. Una restricción en PostgreSQL impide que dos clientes confirmen la misma cancha y hora.",
    init: () => ({ court: "norte", bookings: { norte: new Set(), central: new Set() } }),
    render: renderSlots,
  },
  tiendanova: {
    name: "TiendaNova",
    intro: "Recorre el catálogo, el carrito, los pedidos y la vista de inventario de la tienda.",
    concept: "La aplicación Next.js registra el pedido y descuenta el stock en una transacción. Si el pago simulado se rechaza, el carrito y el stock se conservan.",
    init: () => ({ stock: [2, 4], cart: [0, 0], orders: [], view: "catalogo" }),
    render: renderStore,
  },
};
const state = Object.fromEntries(Object.entries(demos).map(([key, demo]) => [key, demo.init()]));
const columns = ["Por hacer", "En progreso", "Hecho"];
const courts = {
  norte: { name: "Cancha Norte", sport: "Fútbol 5", surface: "Pasto sintético", type: "football", blocked: "18:00" },
  central: { name: "Cancha Central", sport: "Pádel", surface: "Piso sintético y muros", type: "padel", blocked: "17:00" },
};
const times = ["17:00", "18:00", "19:00"];
const products = [
  { name: "Lámpara Aura", price: 34990 },
  { name: "Cuaderno Mapa", price: 11990 },
];
const money = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" });
let active = "taskflow";
let cardId = 6;

function node(tag, content = "", className = "") {
  const element = document.createElement(tag);
  if (content) element.textContent = content;
  if (className) element.className = className;
  return element;
}

function button(label, action, { primary = false, disabled = false, key = "" } = {}) {
  const control = node("button", label, `lab-action${primary ? " primary" : ""}`);
  control.type = "button";
  control.disabled = disabled;
  if (key) control.dataset.control = key;
  control.addEventListener("click", action);
  return control;
}

function refresh(message, focusKey) {
  const wasFocused = body.contains(document.activeElement);
  body.replaceChildren();
  demos[active].render();
  if (wasFocused || focusKey) {
    const focus = [...body.querySelectorAll("[data-control]")].find((element) => element.dataset.control === focusKey && !element.disabled);
    (focus ?? body.querySelector("input, select, button:not([disabled])") ?? document.querySelector("#reset")).focus();
  }
  feedback.textContent = message;
}

function renderBoard() {
  const control = state.taskflow;
  const selected = control.boards.find((board) => board.id === control.selected);
  const cards = selected.cards;
  const overview = node("section", "", "demo-overview");
  overview.setAttribute("aria-labelledby", "board-overview-title");
  const title = node("h3", "Distribución de tableros");
  title.id = "board-overview-title";
  overview.append(title, node("p", "El resumen se actualiza cuando creas o mueves tarjetas en esta demo."));
  const dashboard = node("div", "", "board-overview");
  for (const board of control.boards) {
    const panel = node("div", "", "lab-cell");
    const total = board.cards.length;
    panel.append(node("h4", board.name));
    for (const [index, label] of columns.entries()) {
      const count = board.cards.filter((card) => card.column === index).length;
      const line = node("div", "", "board-count");
      const meter = node("progress");
      meter.max = Math.max(total, 1);
      meter.value = count;
      meter.setAttribute("aria-label", `${board.name}, ${label}: ${count} de ${total}`);
      line.append(node("span", label), meter, node("strong", String(count)));
      panel.append(line);
    }
    dashboard.append(panel);
  }
  overview.append(dashboard);
  const switcher = node("label", "Tablero activo", "field board-switcher");
  const select = node("select");
  select.dataset.control = "boards";
  select.setAttribute("aria-label", "Tablero activo");
  for (const board of control.boards) {
    const option = node("option", board.name);
    option.value = board.id;
    select.append(option);
  }
  select.value = selected.id;
  select.addEventListener("change", () => {
    control.selected = select.value;
    refresh(`Mostrando ${control.boards.find((board) => board.id === select.value).name}.`, "boards");
  });
  switcher.append(select);
  body.append(overview, switcher);
  const grid = node("div", "", "lab-grid");
  for (const [column, name] of columns.entries()) {
    const cell = node("section", "", "lab-cell");
    const matching = cards.filter((card) => card.column === column);
    cell.append(node("h3", `${name} · ${matching.length}`));
    for (const card of matching) {
      const item = node("div", "", "lab-item");
      item.append(node("p", card.title));
      for (const direction of [-1, 1]) {
        const next = column + direction;
        if (!columns[next]) continue;
        const label = `Mover a ${columns[next]}`;
        const control = button(label, () => {
          card.column = next;
          refresh(`${card.title} se movió a ${columns[next]}.`, `card-${card.id}-${column}`);
        }, { key: `card-${card.id}-${next}` });
        control.setAttribute("aria-label", `${label}: ${card.title}`);
        item.append(control);
      }
      cell.append(item);
    }
    grid.append(cell);
  }
  const form = node("form", "", "lab-form");
  const field = node("label", "Título de la tarjeta", "field");
  const input = node("input");
  input.maxLength = 75;
  input.required = true;
  input.dataset.control = "new-card";
  field.append(input);
  const submit = node("button", "Crear tarjeta", "lab-action primary");
  submit.type = "submit";
  form.append(field, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = input.value.trim();
    if (!title) { input.focus(); return; }
    cards.push({ id: ++cardId, title, column: 0 });
    refresh(`Tarjeta creada: ${title}.`, "new-card");
  });
  body.append(node("p", `${cards.filter((card) => card.column === 2).length} de ${cards.length} tarjetas completadas`), grid, form);
}

function renderSlots() {
  const reservation = state.reservaya;
  const court = courts[reservation.court];
  const booked = reservation.bookings[reservation.court];
  const choice = node("label", "Cancha", "field board-switcher");
  const select = node("select");
  select.dataset.control = "courts";
  select.setAttribute("aria-label", "Cancha");
  for (const [key, info] of Object.entries(courts)) {
    const option = node("option", `${info.name} · ${info.sport}`);
    option.value = key;
    select.append(option);
  }
  select.value = reservation.court;
  select.addEventListener("change", () => {
    reservation.court = select.value;
    refresh(`Horarios de ${courts[select.value].name}.`, "courts");
  });
  choice.append(select);

  const preview = node("div", "", "court-preview");
  const field = node("div", "", `court-illustration ${court.type}${booked.size ? " occupied" : ""}`);
  field.setAttribute("aria-hidden", "true");
  field.append(node("span", "", "court-lines"), node("span", "", "court-marker"));
  const description = node("div");
  description.append(node("h3", court.name), node("p", `${court.sport} · ${court.surface}`), node("strong", booked.size ? `Turnos confirmados: ${[...booked].sort().join(", ")}` : "Selecciona un turno disponible"));
  preview.append(field, description);

  const grid = node("div", "", "lab-grid");
  for (const hour of times) {
    const cell = node("section", "", "lab-cell");
    const blocked = hour === court.blocked;
    const selected = booked.has(hour);
    const action = selected ? "Cancelar" : "Reservar";
    const control = button(blocked ? "Bloqueado" : `${action} ${hour}`, () => {
      if (blocked) return;
      if (selected) booked.delete(hour);
      else booked.add(hour);
      refresh(selected ? `Horario ${hour} liberado.` : `Reserva de prueba confirmada a las ${hour}.`, `slot-${hour}`);
    }, { primary: !selected && !blocked, disabled: blocked, key: `slot-${hour}` });
    cell.append(node("h3", hour), node("p", blocked ? "Mantenimiento" : selected ? "Reserva confirmada" : "Disponible"), control);
    grid.append(cell);
  }
  body.append(choice, preview, grid);
}

function renderStore() {
  const store = state.tiendanova;
  const count = store.cart.reduce((sum, amount) => sum + amount, 0);
  const total = products.reduce((sum, product, index) => sum + product.price * store.cart[index], 0);
  const nav = node("div", "", "store-views");
  for (const [view, label] of Object.entries({ catalogo: "Catálogo", carrito: `Carrito (${count})`, pedidos: `Pedidos (${store.orders.length})`, inventario: "Inventario" })) {
    const control = button(label, () => {
      store.view = view;
      refresh("", `view-${view}`);
    }, { key: `view-${view}`, primary: store.view === view });
    control.setAttribute("aria-pressed", String(store.view === view));
    nav.append(control);
  }
  body.append(nav);
  const grid = node("div", "", "lab-grid");

  if (store.view === "catalogo") {
    for (const [index, product] of products.entries()) {
      const cell = node("section", "", "lab-cell");
      const inCart = store.cart[index];
      const add = button("Agregar al carrito", () => {
        if (store.cart[index] >= store.stock[index]) return;
        store.cart[index]++;
        refresh(`${product.name} agregado.`, store.cart[index] === store.stock[index] ? "view-carrito" : `add-${index}`);
      }, { key: `add-${index}`, disabled: inCart >= store.stock[index], primary: true });
      add.setAttribute("aria-label", `Agregar al carrito: ${product.name}`);
      cell.append(node("h3", product.name), node("p", `${money.format(product.price)} · Stock: ${store.stock[index]} · En carrito: ${inCart}`), add);
      grid.append(cell);
    }
  } else if (store.view === "carrito") {
    for (const [index, product] of products.entries()) {
      const quantity = store.cart[index];
      if (!quantity) continue;
      const cell = node("section", "", "lab-cell");
      const remove = button("Quitar una unidad", () => {
        store.cart[index]--;
        refresh(`Quitaste una unidad de ${product.name}.`, store.cart[index] ? `remove-${index}` : "view-carrito");
      }, { key: `remove-${index}` });
      remove.setAttribute("aria-label", `Quitar una unidad: ${product.name}`);
      cell.append(node("h3", product.name), node("p", `${quantity} × ${money.format(product.price)}`), remove);
      grid.append(cell);
    }
    const summary = node("section", "", "lab-cell");
    const buy = button("Aprobar pago", () => {
      if (!count || store.cart.some((quantity, index) => quantity > store.stock[index])) return;
      const order = { id: store.orders.length + 1, quantities: [...store.cart], total };
      store.orders.unshift(order);
      store.cart.forEach((quantity, index) => {
        store.stock[index] -= quantity;
        store.cart[index] = 0;
      });
      store.view = "pedidos";
      refresh(`Pedido de prueba ${order.id} confirmado.`, "view-pedidos");
    }, { primary: true, disabled: !count });
    const decline = button("Rechazar pago", () => {
      feedback.textContent = "Pago de prueba rechazado. El carrito y el stock siguen iguales.";
    }, { disabled: !count });
    const actions = node("div", "", "lab-actions");
    actions.append(buy, decline);
    summary.append(node("h3", "Pago simulado"), node("p", count ? `Total: ${money.format(total)}` : "Tu carrito está vacío."), actions);
    grid.append(summary);
  } else if (store.view === "pedidos") {
    if (!store.orders.length) body.append(node("p", "Aún no hay pedidos confirmados. Prueba una compra desde el carrito."));
    for (const order of store.orders) {
      const cell = node("section", "", "lab-cell");
      cell.append(node("h3", `Pedido #${order.id}`), node("p", `Confirmado · ${money.format(order.total)}`));
      order.quantities.forEach((quantity, index) => {
        if (quantity) cell.append(node("p", `${quantity} × ${products[index].name}`));
      });
      grid.append(cell);
    }
  } else {
    for (const [index, product] of products.entries()) {
      const cell = node("section", "", "lab-cell");
      cell.append(node("h3", product.name), node("p", `Stock disponible: ${store.stock[index]}`), node("strong", !store.stock[index] ? "Agotado" : store.stock[index] === 1 ? "Stock bajo" : "Disponible"));
      grid.append(cell);
    }
  }
  body.append(grid);
}

function openDemo() {
  const requested = location.hash.slice(1);
  const standalone = document.body.dataset.demo;
  if (Object.hasOwn(demos, standalone)) active = standalone;
  else if (Object.hasOwn(demos, requested)) active = requested;
  const demo = demos[active];
  document.querySelector("#demo-title").textContent = demo.name;
  document.querySelector("#demo-intro").textContent = demo.intro;
  document.querySelector("#concept-text").textContent = demo.concept;
  for (const tab of document.querySelectorAll(".lab-nav a")) {
    if (tab.hash === `#${active}`) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  }
  refresh("");
}

document.querySelector("#reset").addEventListener("click", () => {
  state[active] = demos[active].init();
  refresh("Demo reiniciada.");
});
window.addEventListener("hashchange", openDemo);
openDemo();
