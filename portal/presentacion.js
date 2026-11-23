const slides = [
  {
    id: "taskflow",
    category: "Gesti�n de trabajo",
    name: "TaskFlow",
    image: "taskflow.png",
    alt: "Centro de control de TaskFlow con m�tricas y distribuci�n de tarjetas",
    note: "Crea una tarjeta, c�mbiala de columna y mira c�mo se actualiza la distribuci�n del tablero.",
  },
  {
    id: "reservaya",
    category: "Agenda deportiva",
    name: "ReservaYa",
    image: "reservaya-cancha.png",
    alt: "Cancha de ReservaYa junto a su selector de horarios",
    note: "Cambia de cancha para ver sus turnos, confirma una reserva y vuelve a liberar el horario.",
  },
  {
    id: "tiendanova",
    category: "Comercio electr�nico",
    name: "TiendaNova",
    image: "tiendanova.jpg",
    alt: "Cat�logo de TiendaNova con productos de escritorio",
    note: "Agrega un producto, simula un pago y revisa el pedido y el stock resultante.",
  },
  {
    id: "snake",
    category: "Juego interactivo",
    name: "Snake",
    image: "snake.svg",
    alt: "Tablero de Snake con la serpiente y el marcador",
    note: "Elige un modo, juega con teclado o controles t�ctiles y compara tu puntaje en el ranking.",
    href: "https://snake-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/",
    action: "Jugar Snake",
  },
  {
    id: "interrogatorio",
    category: "Deducci�n � Prototipo",
    name: "Interrogatorio",
    image: "interrogatorio.png",
    alt: "Pruebas y sala de interrogatorio del Hotel �nix",
    note: "Elige un expediente, revisa las pruebas e interroga a los sospechosos.",
  },
];

const carousel = document.querySelector("[data-slider]");
const image = carousel.querySelector("#slide-image");
const category = carousel.querySelector("#slide-category");
const name = carousel.querySelector("#slide-name");
const note = carousel.querySelector("#slide-note");
const link = carousel.querySelector("#slide-link");
const content = carousel.querySelector(".slide-content");
const controls = carousel.querySelector(".slider-controls");
const toggle = carousel.querySelector("#slide-toggle");
const selectors = [...carousel.querySelectorAll("[data-slide]")];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const rotationDelay = 7000;
let current = 0;
let timeout;
let manualPause = reduceMotion.matches;
let resumeAfterFocus = false;

function showSlide(index) {
  current = (index + slides.length) % slides.length;
  const slide = slides[current];

  carousel.dataset.theme = slide.id;
  image.src = "capturas/" + slide.image;
  image.alt = slide.alt;
  category.textContent = slide.category;
  name.textContent = slide.name;
  note.textContent = slide.note;
  link.href = slide.href ?? slide.id + "/index.html#demo";
  link.textContent = slide.action ?? "Probar " + slide.name;

  for (const [position, button] of selectors.entries()) {
    button.setAttribute("aria-pressed", String(position === current));
  }

  if (!reduceMotion.matches) {
    for (const element of [image, content]) {
      element.getAnimations().forEach((animation) => animation.cancel());
      element.animate(
        [{ opacity: 0.4, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
        { duration: 330, easing: "ease-out" },
      );
    }
  }
}

function syncRotation() {
  clearTimeout(timeout);
  const pointerInside = matchMedia("(hover: hover)").matches && carousel.matches(":hover");
  const focusInside = carousel.contains(document.activeElement) && !resumeAfterFocus;
  const canRotate = !manualPause && !pointerInside && !focusInside && !document.hidden;
  toggle.textContent = manualPause ? "Reanudar rotaci�n" : "Pausar rotaci�n";
  content.setAttribute("aria-live", canRotate ? "off" : "polite");

  if (canRotate) {
    timeout = setTimeout(() => {
      showSlide(current + 1);
      syncRotation();
    }, rotationDelay);
  }
}

for (const button of selectors) {
  button.addEventListener("click", () => {
    showSlide(Number(button.dataset.slide));
    syncRotation();
  });
}

carousel.querySelector("#slide-prev").addEventListener("click", () => {
  showSlide(current - 1);
  syncRotation();
});
carousel.querySelector("#slide-next").addEventListener("click", () => {
  showSlide(current + 1);
  syncRotation();
});

toggle.addEventListener("click", () => {
  manualPause = !manualPause;
  resumeAfterFocus = !manualPause;
  syncRotation();
});

carousel.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  showSlide(current + (event.key === "ArrowLeft" ? -1 : 1));
  selectors[current].focus();
});

carousel.addEventListener("focusin", (event) => {
  if (event.target !== toggle) resumeAfterFocus = false;
  syncRotation();
});
carousel.addEventListener("focusout", (event) => {
  if (!carousel.contains(event.relatedTarget)) resumeAfterFocus = false;
  queueMicrotask(syncRotation);
});
carousel.addEventListener("mouseenter", syncRotation);
carousel.addEventListener("mouseleave", syncRotation);
document.addEventListener("visibilitychange", syncRotation);
reduceMotion.addEventListener("change", (event) => {
  if (event.matches) manualPause = true;
  syncRotation();
});

controls.hidden = false;
syncRotation();
