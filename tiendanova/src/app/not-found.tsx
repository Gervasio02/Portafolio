import Link from "next/link";

export default function NotFound() {
  return (
    <section className="wrap narrow workpage">
      <h1>Página no disponible</h1>
      <Link href="/" className="button dark">
        Volver al catálogo
      </Link>
    </section>
  );
}
