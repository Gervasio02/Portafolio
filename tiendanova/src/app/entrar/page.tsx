import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/forms";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const { volver } = await searchParams;
  return (
    <section className="wrap narrow workpage">
      <div className="panel auth-panel">
        <p className="eyebrow">Cuenta Nova</p>
        <h1>Inicia sesión</h1>
        <p className="muted">
          Accede a tu carrito, direcciones y pedidos de prueba.
        </p>
        <AuthForm mode="login" returnTo={volver} />
        <p className="muted">
          ¿Aún sin cuenta?{" "}
          <Link
            href={
              volver === "carrito" ? "/registro?volver=carrito" : "/registro"
            }
            className="text-link"
          >
            Regístrate
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
