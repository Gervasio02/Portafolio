import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/forms";

export const metadata: Metadata = {
  title: "Registro",
  robots: { index: false },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const { volver } = await searchParams;
  return (
    <section className="wrap narrow workpage">
      <div className="panel auth-panel">
        <p className="eyebrow">Cuenta Nova</p>
        <h1>Crea tu cuenta</h1>
        <p className="muted">
          Usa datos ficticios para guardar tu carrito y probar la compra.
        </p>
        <AuthForm mode="register" returnTo={volver} />
        <p className="muted">
          ¿Ya tienes una cuenta?{" "}
          <Link
            href={volver === "carrito" ? "/entrar?volver=carrito" : "/entrar"}
            className="text-link"
          >
            Entra aquí
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
