"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { importCart, updateCart, type FormState } from "@/app/actions";
import {
  parseCart,
  readCartSnapshot,
  readServerSnapshot,
  subscribeCart,
  writeLocalCart,
  type LocalItem,
} from "@/lib/cart-storage";
import { Feedback } from "./forms";

type Item = LocalItem & { active?: boolean };
const price = (amount: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(
    amount,
  );

export function Cart({
  signedIn,
  items,
  children,
}: {
  signedIn: boolean;
  items: Item[];
  children?: React.ReactNode;
}) {
  const snapshot = useSyncExternalStore(
    subscribeCart,
    readCartSnapshot,
    readServerSnapshot,
  );
  const local = useMemo(() => parseCart(snapshot), [snapshot]);
  const selected: Item[] = signedIn ? items : local;
  const [pending, start] = useTransition();
  const [state, setState] = useState<FormState>({});
  const subtotal = selected.reduce(
    (total, line) => total + line.price * line.quantity,
    0,
  );

  function change(productId: string, quantity: number) {
    start(async () => {
      if (signedIn) {
        setState(await updateCart(productId, quantity));
        return;
      }
      const result = writeLocalCart(
        local.flatMap((line) =>
          line.productId === productId
            ? quantity
              ? [{ ...line, quantity }]
              : []
            : [line],
        ),
      );
      setState(
        result
          ? {}
          : { error: "No pudimos guardar tu carrito en este navegador." },
      );
    });
  }

  return (
    <div className="cart-grid">
      <div>
        {signedIn && local.length > 0 && (
          <div className="panel import-panel">
            <p>Tienes productos guardados en este navegador.</p>
            <button
              type="button"
              className="button outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await importCart(
                    local.map(({ productId, quantity }) => ({
                      productId,
                      quantity,
                    })),
                  );
                  if (result.success) writeLocalCart([]);
                  setState(result);
                })
              }
            >
              Importar mi carrito local
            </button>
          </div>
        )}
        <Feedback state={state} />
        {selected.length ? (
          <ul className="cart-list">
            {selected.map((line) => (
              <li className="cart-line" key={line.productId}>
                <Image
                  src={line.image}
                  alt=""
                  width={92}
                  height={82}
                  className="cart-image"
                />
                <div className="line-title">
                  <Link href={`/catalogo/${line.slug}`}>{line.name}</Link>
                  <p className="muted small">{price(line.price)} por unidad</p>
                  {(line.active === false || line.quantity > line.stock) && (
                    <p className="error-text small">
                      Disponibilidad actual:{" "}
                      {line.active === false ? "agotado" : line.stock}
                    </p>
                  )}
                </div>
                <div className="qty" aria-label={`Cantidad de ${line.name}`}>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Quitar una unidad de ${line.name}`}
                    disabled={pending || line.quantity === 1}
                    onClick={() => change(line.productId, line.quantity - 1)}
                  >
                    <Minus size={15} />
                  </button>
                  <span>{line.quantity}</span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Agregar una unidad de ${line.name}`}
                    disabled={
                      pending ||
                      line.active === false ||
                      line.quantity >= Math.min(25, line.stock)
                    }
                    onClick={() => change(line.productId, line.quantity + 1)}
                  >
                    <Plus size={15} />
                  </button>
                </div>
                <div className="line-price">
                  <strong>{price(line.price * line.quantity)}</strong>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Eliminar ${line.name}`}
                    disabled={pending}
                    onClick={() => change(line.productId, 0)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">
            <ShoppingBag size={28} />
            <h2>Tu carrito está vacío</h2>
            <Link className="button outline" href="/#catalogo">
              Explorar catálogo <ArrowRight size={17} />
            </Link>
          </div>
        )}
      </div>
      <aside className="panel summary">
        <h2>Resumen</h2>
        <div className="summary-line">
          <span>Subtotal</span>
          <strong>{price(subtotal)}</strong>
        </div>
        <p className="muted small">
          Los pagos son de prueba. La compra no genera cobros ni envíos reales.
        </p>
        {signedIn
          ? selected.length > 0 && children
          : selected.length > 0 && (
              <Link href="/entrar?volver=carrito" className="button dark full">
                Inicia sesión para comprar <ArrowRight size={16} />
              </Link>
            )}
      </aside>
    </div>
  );
}
