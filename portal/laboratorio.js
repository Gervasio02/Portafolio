const body = document.querySelector("#demo-body");
const feedback = document.querySelector("#feedback");
const demos = {
  taskflow: {
    name: "TaskFlow",
    intro: "Supervisa entregas e incidentes. Filtra por prioridad y mueve una tarjeta para actualizar el panel al instante.",
    concept: "La API de Express comprueba el rol de cada usuario y guarda el orden de las tarjetas en PostgreSQL.",
    init: () => ({
      selected: "entregas",
      priority: "todas",
      boards: [
        { id: "entregas", name: "Entregas", cards: [
          { id: 1, title: "Preparar entrega del viernes", column: 0, priority: "media" },
          { id: 2, title: "Validar el entorno de pruebas", column: 1, priority: "alta" },
          { id: 3, title: "Aprobar alcance de la entrega", column: 2, priority: "baja" },
        ] },
        { id: "incidentes", name: "Incidentes", cards: [
          { id: 4, title: "Diagnosticar factura duplicada", column: 0, priority: "alta" },
          { id: 5, title: "Revisar tiempos de respuesta", column: 0, priority: "media" },
          { id: 6, title: "Confirmar corrección de inventario", column: 1, priority: "alta" },
        ] },
      ],
    }),
    render: renderBoard,
  },
  reservaya: {
    name: "ReservaYa",
    intro: "Compara horarios por cancha y fecha. Tus turnos confirmados se guardan en la lista de esta demo.",
    concept: "La aplicación FastAPI comprueba bloqueos y horarios. Una restricción en PostgreSQL impide que dos clientes confirmen la misma cancha y hora.",
    init: () => ({ court: "norte", day: 0, bookings: [] }),
    render: renderSlots,
  },
  tiendanova: {
    name: "TiendaNova",
    intro: "Busca un producto, prueba el pago y sigue tu pedido hasta la entrega simulada.",
    concept: "La aplicación Next.js registra el pedido y descuenta el stock en una transacción. Si el pago simulado se rechaza, el carrito y el stock se conservan.",
    init: () => ({ stock: [2, 4], cart: [0, 0], orders: [], view: "catalogo", query: "" }),
    render: renderStore,
  },
};
const state = Object.fromEntries(Object.entries(demos).map(([key, demo]) => [key, demo.init()]));
const priorities = { alta: "Alta", media: "Media", baja: "Baja" };
const columns = ["Por hacer", "En progreso", "Hecho"];
const courts = {
  norte: { name: "Cancha Norte", sport: "Fútbol 5", surface: "Pasto sintético", type: "football", blocked: "18:00" },
  central: { name: "Cancha Central", sport: "Pádel", surface: "Piso sintético y muros", type: "padel", blocked: "17:00" },
};
const times = ["17:00", "18:00", "19:00"];
const calendarDay = new Intl.DateTimeFormat("es-CL", { weekday: "short", day: "numeric", month: "short" });
const firstDay = new Date();
const availableDays = Array.from({ length: 7 }, (_, offset) => {
  const next = new Date(firstDay);
  next.setDate(next.getDate() + offset);
  return calendarDay.format(next);
});
const products = [
  { name: "Lámpara Aura", price: 34990, image: "lamp.jpg", description: "Lámpara de escritorio" },
  { name: "Cuaderno Mapa", price: 11990, image: "notebook.jpg", description: "Cuaderno para notas y bocetos" },
];
const orderStages = ["Confirmado", "Enviado", "Entregado"];
const assets = new URL("capturas/productos/", document.currentScript.src);
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

function selectField(label, key, options, value, onChange) {
  const field = node("label", label, "field");
  const select = node("select");
  select.dataset.control = key;
  for (const [id, text] of options) {
    const option = node("option", text);
    option.value = id;
    select.append(option);
  }
  select.value = value;
  if (onChange) select.addEventListener("change", () => onChange(select.value));
  field.append(select);
  return { field, select };
}

function renderBoard() {
  const boardState = state.taskflow;
  const selected = boardState.boards.find((board) => board.id === boardState.selected);
  const cards = selected.cards;
  const visibleCards = boardState.priority === "todas" ? cards : cards.filter((card) => card.priority === boardState.priority);
  const overview = node("section", "", "demo-overview");
  overview.setAttribute("aria-labelledby", "board-overview-title");
  const title = node("h3", "Distribución de tableros");
  title.id = "board-overview-title";
  overview.append(title, node("p", "El resumen cuenta todas las tarjetas de cada tablero y se actualiza con cada cambio."));
  const dashboard = node("div", "", "board-overview");
  for (const board of boardState.boards) {
    const panel = node("div", "", "lab-cell");
    const total = board.cards.length;
    panel.append(node("h4", board.name), node("p", `${board.cards.filter((card) => card.priority === "alta").length} de prioridad alta`));
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

  const filters = node("div", "", "demo-filters");
  const boardSelector = selectField("Tablero activo", "boards", boardState.boards.map(({ id, name }) => [id, name]), selected.id, (id) => {
    boardState.selected = id;
    refresh(`Mostrando ${boardState.boards.find((board) => board.id === id).name}.`, "boards");
  });
  const prioritySelector = selectField("Filtrar por prioridad", "priority-filter", [["todas", "Todas"], ...Object.entries(priorities)], boardState.priority, (value) => {
    boardState.priority = value;
    refresh(value === "todas" ? "Se muestran todas las prioridades." : `Prioridad seleccionada: ${priorities[value]}.`, "priority-filter");
  });
  filters.append(boardSelector.field, prioritySelector.field);

  const grid = node("div", "", "lab-grid");
  for (const [column, name] of columns.entries()) {
    const cell = node("section", "", "lab-cell");
    const matching = visibleCards.filter((card) => card.column === column);
    cell.append(node("h3", `${name} · ${matching.length}`));
    if (!matching.length) cell.append(node("p", "Sin tarjetas para esta vista.", "demo-muted"));
    for (const card of matching) {
      const item = node("div", "", "lab-item");
      const tag = node("span", `Prioridad ${priorities[card.priority].toLocaleLowerCase("es")}`, "demo-tag");
      tag.dataset.tone = card.priority;
      item.append(node("p", card.title), tag);
      for (const direction of [-1, 1]) {
        const next = column + direction;
        if (!columns[next]) continue;
        const label = `Mover a ${columns[next]}`;
        const move = button(label, () => {
          card.column = next;
          refresh(`${card.title} se movió a ${columns[next]}.`, `card-${card.id}-${column}`);
        }, { key: `card-${card.id}-${next}` });
        move.setAttribute("aria-label", `${label}: ${card.title}`);
        item.append(move);
      }
      cell.append(item);
    }
    grid.append(cell);
  }

  const form = node("form", "", "lab-form card-entry");
  const field = node("label", "Título de la tarjeta", "field");
  const input = node("input");
  input.maxLength = 75;
  input.required = true;
  input.dataset.control = "new-card";
  field.append(input);
  const priority = selectField("Prioridad de la tarjeta", "card-priority", Object.entries(priorities), "media");
  const submit = node("button", "Crear tarjeta", "lab-action primary");
  submit.type = "submit";
  form.append(field, priority.field, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = input.value.trim();
    if (!title) { input.focus(); return; }
    const value = priority.select.value;
    cards.push({ id: ++cardId, title, priority: value, column: 0 });
    const filterChanged = boardState.priority !== "todas" && boardState.priority !== value;
    if (filterChanged) boardState.priority = "todas";
    refresh(`Tarjeta creada: ${title}.${filterChanged ? " Se muestran todas las prioridades." : ""}`, "new-card");
  });
  const completed = cards.filter((card) => card.column === 2).length;
  body.append(
    overview,
    filters,
    node("p", `${completed} de ${cards.length} tarjetas completadas · ${visibleCards.length} visibles`, "demo-muted"),
    grid,
    form,
  );
}

function renderSlots() {
  const reservation = state.reservaya;
  const court = courts[reservation.court];
  const date = availableDays[reservation.day];
  const booked = reservation.bookings.filter((entry) => entry.court === reservation.court && entry.day === reservation.day);
  const blocked = times[(times.indexOf(court.blocked) + reservation.day) % times.length];
  const filters = node("div", "", "demo-filters");
  const courtSelector = selectField("Cancha", "courts", Object.entries(courts).map(([id, info]) => [id, `${info.name} · ${info.sport}`]), reservation.court, (value) => {
    reservation.court = value;
    refresh(`Horarios de ${courts[value].name}.`, "courts");
  });
  const dateSelector = selectField("Fecha", "reservation-day", availableDays.map((day, index) => [index, day]), reservation.day, (value) => {
    reservation.day = Number(value);
    refresh(`Fecha seleccionada: ${availableDays[value]}.`, "reservation-day");
  });
  filters.append(courtSelector.field, dateSelector.field);

  const preview = node("div", "", "court-preview");
  const field = node("div", "", `court-illustration ${court.type}${booked.length ? " occupied" : ""}`);
  field.setAttribute("aria-hidden", "true");
  field.append(node("span", "", "court-lines"), node("span", "", "court-marker"));
  const description = node("div");
  const available = times.length - 1 - booked.length;
  description.append(
    node("h3", court.name),
    node("p", `${court.sport} · ${court.surface}`),
    node("p", date),
    node("strong", available === 1 ? "1 turno disponible" : `${available} turnos disponibles`),
  );
  if (booked.length) description.append(node("p", `Turnos confirmados: ${booked.map((item) => item.hour).sort().join(", ")}`));
  preview.append(field, description);

  const grid = node("div", "", "lab-grid");
  for (const hour of times) {
    const cell = node("section", "", "lab-cell");
    const isBlocked = hour === blocked;
    const existing = booked.find((entry) => entry.hour === hour);
    const action = existing ? "Cancelar" : "Reservar";
    const control = button(isBlocked ? "Bloqueado" : `${action} ${hour}`, () => {
      if (existing) {
        cancelReservation(existing, `slot-${hour}`);
        return;
      }
      reservation.bookings.push({ court: reservation.court, day: reservation.day, hour });
      refresh(`Reserva de prueba confirmada a las ${hour}.`, `slot-${hour}`);
    }, { primary: !existing && !isBlocked, disabled: isBlocked, key: `slot-${hour}` });
    cell.append(node("h3", hour), node("p", isBlocked ? "Mantenimiento" : existing ? "Reserva confirmada" : "Disponible"), control);
    grid.append(cell);
  }

  const history = node("section", "", "bookings-summary");
  history.append(node("h3", "Mis reservas de prueba"));
  if (!reservation.bookings.length) history.append(node("p", "Los turnos confirmados aparecerán aquí.", "demo-muted"));
  const ordered = [...reservation.bookings].sort((a, b) => a.day - b.day || a.hour.localeCompare(b.hour));
  for (const entry of ordered) {
    const row = node("div", "", "demo-list-row");
    const detail = node("div");
    detail.append(node("strong", courts[entry.court].name), node("p", `${availableDays[entry.day]} · ${entry.hour}`, "demo-muted"));
    const cancel = button("Cancelar reserva", () => cancelReservation(entry, "reservation-day"));
    cancel.setAttribute("aria-label", `Cancelar reserva de ${courts[entry.court].name} a las ${entry.hour} del ${availableDays[entry.day]}`);
    row.append(detail, cancel);
    history.append(row);
  }
  body.append(filters, preview, grid, history);
}

function cancelReservation(entry, focusKey) {
  const reservations = state.reservaya.bookings;
  reservations.splice(reservations.indexOf(entry), 1);
  refresh(`Horario ${entry.hour} liberado.`, focusKey);
}

function renderStore() {
  const store = state.tiendanova;
  const count = store.cart.reduce((sum, amount) => sum + amount, 0);
  const total = products.reduce((sum, product, index) => sum + product.price * store.cart[index], 0);
  const nav = node("div", "", "store-views");
  nav.setAttribute("role", "group");
  nav.setAttribute("aria-label", "Vistas de TiendaNova");
  for (const [view, label] of Object.entries({ catalogo: "Catálogo", carrito: `Carrito (${count})`, pedidos: `Pedidos (${store.orders.length})`, inventario: "Inventario" })) {
    const control = button(label, () => {
      store.view = view;
      refresh("", `view-${view}`);
    }, { key: `view-${view}`, primary: store.view === view });
    control.setAttribute("aria-pressed", String(store.view === view));
    nav.append(control);
  }

  const grid = node("div", "", "lab-grid store-grid");
  body.append(nav);
  if (store.view === "catalogo") renderCatalog(store, grid);
  if (store.view === "carrito") renderCart(store, grid, count, total);
  if (store.view === "pedidos") renderOrders(store, grid);
  if (store.view === "inventario") renderInventory(store, grid);
  if (grid.children.length) body.append(grid);
}

function renderCatalog(store, grid) {
  const search = node("form", "", "lab-form store-search");
  const field = node("label", "Buscar un producto", "field");
  const input = node("input");
  input.type = "search";
  input.value = store.query;
  input.dataset.control = "product-search";
  field.append(input);
  const submit = node("button", "Buscar", "lab-action");
  submit.type = "submit";
  const reset = button("Mostrar todo", () => {
    store.query = "";
    refresh("Se muestra todo el catálogo.", "product-search");
  });
  search.append(field, submit);
  if (store.query) search.append(reset);
  search.addEventListener("submit", (event) => {
    event.preventDefault();
    store.query = input.value.trim().slice(0, 80);
    const matches = products.filter((product) => matchesProduct(product, store.query)).length;
    refresh(matches === 1 ? "1 producto encontrado." : `${matches} productos encontrados.`, "product-search");
  });
  body.append(search);

  for (const [index, product] of products.entries()) {
    if (!matchesProduct(product, store.query)) continue;
    const cell = node("section", "", "lab-cell store-product");
    const image = node("img", "", "store-product-photo");
    image.src = new URL(product.image, assets);
    image.alt = "";
    image.loading = "lazy";
    const inCart = store.cart[index];
    const add = button("Agregar al carrito", () => updateQuantity(store, index, 1, `add-${index}`), {
      key: `add-${index}`,
      disabled: inCart >= store.stock[index],
      primary: true,
    });
    add.setAttribute("aria-label", `Agregar al carrito: ${product.name}`);
    cell.append(
      image,
      node("h3", product.name),
      node("p", product.description, "demo-muted"),
      node("p", `${money.format(product.price)} · Stock: ${store.stock[index]} · En carrito: ${inCart}`),
      add,
    );
    grid.append(cell);
  }
  if (!grid.children.length) body.append(node("p", "No encontramos productos. Prueba otro nombre o muestra todo el catálogo."));
}

function matchesProduct(product, query) {
  const normalize = (text) => text.toLocaleLowerCase("es").normalize("NFD").replace(/\p{Diacritic}/gu, "");
  return normalize(`${product.name} ${product.description}`).includes(normalize(query));
}

function renderCart(store, grid, count, total) {
  for (const [index, product] of products.entries()) {
    const quantity = store.cart[index];
    if (!quantity) continue;
    const cell = node("section", "", "lab-cell");
    const actions = node("div", "", "lab-actions");
    const less = button("Quitar una unidad", () => updateQuantity(store, index, -1, `remove-${index}`), {
      key: `remove-${index}`,
    });
    less.setAttribute("aria-label", `Quitar una unidad: ${product.name}`);
    const more = button("Añadir una unidad", () => updateQuantity(store, index, 1, `more-${index}`), {
      key: `more-${index}`,
      disabled: quantity >= store.stock[index],
    });
    more.setAttribute("aria-label", `Añadir una unidad: ${product.name}`);
    actions.append(less, more);
    cell.append(node("h3", product.name), node("p", `${quantity} × ${money.format(product.price)}`), actions);
    grid.append(cell);
  }

  const summary = node("section", "", "lab-cell");
  const buy = button("Aprobar pago", () => {
    if (!count || store.cart.some((quantity, index) => quantity > store.stock[index])) return;
    const order = { id: store.orders.length + 1, quantities: [...store.cart], total, stage: 0 };
    store.orders.unshift(order);
    store.cart.forEach((quantity, index) => {
      store.stock[index] -= quantity;
      store.cart[index] = 0;
    });
    store.view = "pedidos";
    refresh(`Pedido de prueba ${order.id} confirmado.`, "view-pedidos");
  }, { primary: true, disabled: !count, key: "payment" });
  const decline = button("Rechazar pago", () => {
    feedback.textContent = "Pago de prueba rechazado. El carrito y el stock siguen iguales.";
  }, { disabled: !count });
  const actions = node("div", "", "lab-actions");
  actions.append(buy, decline);
  summary.append(node("h3", "Pago simulado"), node("p", count ? `Total: ${money.format(total)}` : "Tu carrito está vacío."), actions);
  grid.append(summary);
}

function updateQuantity(store, index, change, focusKey) {
  const quantity = store.cart[index] + change;
  if (quantity < 0 || quantity > store.stock[index]) return;
  store.cart[index] = quantity;
  const fallback = store.view === "catalogo" ? "view-carrito" : quantity ? `remove-${index}` : "view-carrito";
  const focus = quantity > 0 && (change < 0 || quantity < store.stock[index]) ? focusKey : fallback;
  const action = change > 0 ? "agregada al carrito" : "quitada del carrito";
  refresh(`Unidad de ${products[index].name} ${action}.`, focus);
}

function renderOrders(store, grid) {
  if (!store.orders.length) body.append(node("p", "Aún no hay pedidos confirmados. Prueba una compra desde el carrito."));
  for (const order of store.orders) {
    const cell = node("section", "", "lab-cell");
    cell.append(node("h3", `Pedido #${order.id}`), node("p", money.format(order.total)));
    order.quantities.forEach((quantity, index) => {
      if (quantity) cell.append(node("p", `${quantity} × ${products[index].name}`));
    });
    const timeline = node("ol", "", "order-progress");
    timeline.setAttribute("aria-label", `Estado del pedido ${order.id}`);
    for (const [index, stage] of orderStages.entries()) {
      const step = node("li", stage);
      if (index < order.stage) step.dataset.complete = "true";
      if (index === order.stage) step.setAttribute("aria-current", "step");
      timeline.append(step);
    }
    cell.append(timeline);
    if (order.stage < orderStages.length - 1) {
      const key = `advance-${order.id}`;
      const advance = button(order.stage === 0 ? "Simular envío" : "Simular entrega", () => {
        order.stage++;
        const nextFocus = order.stage < orderStages.length - 1 ? key : "view-pedidos";
        refresh(`Pedido ${order.id}: ${orderStages[order.stage].toLocaleLowerCase("es")}.`, nextFocus);
      }, { key });
      cell.append(advance);
    }
    grid.append(cell);
  }
}

function renderInventory(store, grid) {
  for (const [index, product] of products.entries()) {
    const cell = node("section", "", "lab-cell");
    const remaining = store.stock[index];
    cell.append(
      node("h3", product.name),
      node("p", `Stock disponible: ${remaining}`),
      node("strong", !remaining ? "Agotado" : remaining === 1 ? "Stock bajo" : "Disponible"),
    );
    grid.append(cell);
  }
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
