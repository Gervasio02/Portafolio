import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { money } from "@/lib/commerce";
import { statusNames } from "@/lib/validation";
import { AddressForm } from "@/components/forms";
import { removeAddress, logout } from "@/app/actions";

export const metadata: Metadata = {
  title: "Mi cuenta",
  robots: { index: false },
};

export default async function AccountPage() {
  const user = await requireUser();
  const [orders, addresses] = await Promise.all([
    db.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.address.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return (
    <section className="wrap workpage">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Mi cuenta</p>
          <h1>Hola, {user.name}</h1>
          <p className="muted">{user.email}</p>
        </div>
        <form action={logout}>
          <button className="button outline">Cerrar sesión</button>
        </form>
      </div>
      <div className="account-grid">
        <section className="panel">
          <h2>Historial de pedidos</h2>
          {orders.length ? (
            <ul className="clean-list">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link
                    className="order-row"
                    href={`/cuenta/pedidos/${order.id}`}
                  >
                    <span>
                      <strong>Pedido {order.id.slice(-8).toUpperCase()}</strong>
                      <small>
                        {new Intl.DateTimeFormat("es-CL", {
                          dateStyle: "medium",
                          timeZone: "America/Santiago",
                        }).format(order.createdAt)}{" "}
                        · {statusNames[order.status]}
                      </small>
                    </span>
                    <span>
                      {money(order.total)} <ArrowUpRight size={17} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              Tus compras de demostración aparecerán aquí.
            </p>
          )}
        </section>
        <section className="panel">
          <h2>Direcciones</h2>
          {addresses.length > 0 && (
            <ul className="clean-list">
              {addresses.map((address) => (
                <li key={address.id} className="address-row">
                  <MapPin size={19} />
                  <div>
                    <strong>{address.label}</strong>
                    <p className="small muted">
                      {address.street}, {address.city}, {address.region}
                    </p>
                  </div>
                  <form action={removeAddress}>
                    <input type="hidden" name="id" value={address.id} />
                    <button
                      className="plain"
                      aria-label={`Eliminar dirección ${address.label}`}
                    >
                      Eliminar
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <details open={!addresses.length}>
            <summary>Agregar dirección</summary>
            <AddressForm />
          </details>
        </section>
      </div>
    </section>
  );
}
