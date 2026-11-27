import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ShoppingBag } from "lucide-react";
import { currentUser } from "@/lib/session";
import { logout } from "./actions";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TiendaNova · Iluminación y accesorios de escritorio",
    template: "%s · TiendaNova",
  },
  description:
    "Tienda de demostración. Iluminación, accesorios y piezas para tu espacio de trabajo.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  return (
    <html lang="es-CL">
      <body>
        <a className="skip" href="#main">
          Ir al contenido
        </a>
        <header className="topbar">
          <div className="wrap topbar-inner">
            <Link href="/" className="brand" aria-label="TiendaNova, inicio">
              <span className="brand-mark" aria-hidden>
                ✳
              </span>
              TiendaNova<span>.</span>
            </Link>
            <nav aria-label="Principal">
              <Link href="/#catalogo">Catálogo</Link>
              {user?.role === "ADMIN" && <Link href="/admin">Administrar</Link>}
              <Link href={user ? "/cuenta" : "/entrar"}>
                {user ? "Mi cuenta" : "Entrar"}
              </Link>
              <Link href="/carrito" className="bag-link">
                <ShoppingBag aria-hidden size={17} /> <span>Carrito</span>
              </Link>
            </nav>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="footer">
          <div className="wrap footer-inner">
            <div>
              <Link href="/" className="brand">
                <span className="brand-mark" aria-hidden>
                  ✳
                </span>
                TiendaNova<span>.</span>
              </Link>
              <p>Tienda de demostración · Pagos simulados</p>
            </div>
            <Link href="/#catalogo" className="text-link">
              Volver al catálogo <ArrowUpRight size={15} />
            </Link>
            {user && (
              <form action={logout}>
                <button type="submit" className="plain">
                  Cerrar sesión
                </button>
              </form>
            )}
          </div>
        </footer>
        <a
          className="volver-portafolio"
          href="https://gervasio.sbs/#tiendanova"
          title="Volver al portafolio de Gervasio Torres"
        >
          <span aria-hidden="true">←</span> Portafolio
        </a>
      </body>
    </html>
  );
}
