import type { Status } from "@prisma/client";
import { Check, CreditCard, PackageCheck, Truck } from "lucide-react";

const steps = [
  {
    status: "PAID",
    title: "Pago aprobado",
    detail: "La compra se registró y las unidades se descontaron del stock.",
    icon: CreditCard,
  },
  {
    status: "SHIPPED",
    title: "Pedido enviado",
    detail: "La tienda marcó el pedido como despachado.",
    icon: Truck,
  },
  {
    status: "DELIVERED",
    title: "Pedido entregado",
    detail: "La tienda confirmó la entrega de prueba.",
    icon: PackageCheck,
  },
] as const;

export function OrderTimeline({ status }: { status: Status }) {
  const current = steps.findIndex((step) => step.status === status);
  return (
    <section className="panel timeline-panel" aria-labelledby="follow-title">
      <h2 id="follow-title">Seguimiento del pedido</h2>
      <ol className="timeline-list">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li
              key={step.status}
              className={
                index === current
                  ? "timeline-current"
                  : index < current
                    ? "timeline-done"
                    : "timeline-pending"
              }
              aria-current={index === current ? "step" : undefined}
            >
              <span className="timeline-icon" aria-hidden>
                {index < current ? <Check size={20} /> : <Icon size={20} />}
              </span>
              <div>
                <strong>{step.title}</strong>
                <p>
                  {index <= current ? step.detail : "Pendiente de confirmación"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
