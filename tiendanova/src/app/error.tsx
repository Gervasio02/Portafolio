"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="wrap narrow workpage">
      <p className="eyebrow">TiendaNova</p>
      <h1>No pudimos cargar esta página</h1>
      <p className="muted">Intenta de nuevo en unos segundos.</p>
      <button className="button dark" onClick={reset}>
        Volver a intentar
      </button>
    </section>
  );
}
