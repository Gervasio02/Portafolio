import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { money } from "@/lib/commerce";
import { addressSchema } from "@/lib/validation";
import { cancelMyOrder } from "@/app/actions";
import { OrderTimeline } from "@/components/order-timeline";

export const metadata: Metadata = {
  title: "Detalle del pedido",
  robots: { index: false },
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ confirmado?: string }>;
}) {
  const [{ id }, user, { confirmado }] = await Promise.all([
    params,
    requireUser(),
    searchParams,
  ]);
  const order = await db.order.findFirst({
    where: { id, userId: user.id },
    include: { items: true },
  });
  if (!order) notFound();
  const address = addressSchema.safeParse(order.address);
  return (
    <section className="wrap order-page workpage">
      <Link href="/cuenta" className="text-link back-link">
        <ArrowLeft size={16} /> Volver a mi cuenta
      </Link>
      {confirmado === "1" && (
        <div role="status" className="success-banner">
          <CheckCircle2 size={24} /> Compra de prueba confirmada
        </div>
      )}
      <p className="eyebrow">Pedido</p>
      <h1>{order.id.slice(-8).toUpperCase()}</h1>
      <OrderTimeline status={order.status} />
      {order.status === "PAID" && <form action={cancelMyOrder}><input type="hidden" name="id" value={order.id}/><button type="submit">Cancelar pedido de prueba</button></form>}
      <div className="panel">
        <h2>Resumen de compra</h2>
        <ul className="clean-list order-items">
          {order.items.map((item) => (
            <li key={item.id}>
              <span>
                {item.name} × {item.quantity}
              </span>
              <strong>{money(item.price * item.quantity)}</strong>
            </li>
          ))}
        </ul>
        <p className="summary-line">
          <strong>Total</strong>
          <strong>{money(order.total)}</strong>
        </p>
        {address.success && (
          <p className="muted">
            Dirección: {address.data.street}, {address.data.city},{" "}
            {address.data.region}
          </p>
        )}
      </div>
    </section>
  );
}
