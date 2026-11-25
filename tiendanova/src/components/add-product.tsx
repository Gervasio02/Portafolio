"use client";

import Link from "next/link";
import { Check, Package, ShoppingBag } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { addToCart, type FormState } from "@/app/actions";
import {
  parseCart,
  readCartSnapshot,
  writeLocalCart,
  type LocalItem,
} from "@/lib/cart-storage";

export function AddProduct({
  product,
  variants,
  isSignedIn,
}: {
  product: Omit<LocalItem, "quantity">;
  variants: {
    id: string;
    name: string;
    priceAdjustment: number;
    stock: number;
  }[];
  isSignedIn: boolean;
}) {
  const [quantity, setQuantity] = useState(1);
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "base");
  const [liveStock, setLiveStock] = useState<number | undefined>();
  const variant = variants.find((candidate) => candidate.id === variantId);
  const stock = liveStock ?? variant?.stock ?? product.stock;
  const selectedProduct = {
    ...product,
    variantId,
    variantName: variant?.name,
    price: product.price + (variant?.priceAdjustment ?? 0),
    stock,
  };
  useEffect(() => {
    const request = new AbortController();
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch(
          `/api/products/${product.productId}/availability?variant=${encodeURIComponent(variantId)}`,
          { signal: request.signal, cache: "no-store" },
        );
        const result: unknown = await response.json();
        if (
          !response.ok ||
          !result ||
          typeof result !== "object" ||
          !("stock" in result)
        )
          return;
        if (
          typeof result.stock === "number" &&
          Number.isInteger(result.stock) &&
          result.stock >= 0
        )
          setLiveStock(result.stock);
      } catch {
        // Keep the last known stock. The database checks every attempted purchase.
      }
    };
    const interval = window.setInterval(refresh, 20_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      request.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [product.productId, variantId]);
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  const available = Math.min(25, stock);
  return (
    <>
      <p
        className={stock ? "availability" : "availability out"}
        aria-live="polite"
      >
        {stock ? <Check size={16} /> : <Package size={16} />}
        {stock ? `${stock} en stock` : "Agotado"}
      </p>
      <form
        className="add-form"
        onSubmit={(event) => {
          event.preventDefault();
          start(async () => {
            if (isSignedIn) {
              setState(
                await addToCart({
                  productId: product.productId,
                  variantId,
                  quantity,
                }),
              );
              return;
            }
            const local = parseCart(readCartSnapshot());
            const previous = local.find(
              (line) =>
                line.productId === product.productId &&
                line.variantId === variantId,
            );
            const total = (previous?.quantity ?? 0) + quantity;
            if (total > available) {
              setState({
                error: "No hay unidades suficientes para esa cantidad.",
              });
              return;
            }
            if (!previous && local.length >= 20) {
              setState({
                error: "Tu carrito puede tener hasta 20 productos distintos.",
              });
              return;
            }
            const next = [
              ...local.filter(
                (line) =>
                  line.productId !== product.productId ||
                  line.variantId !== variantId,
              ),
              { ...selectedProduct, quantity: total },
            ];
            setState(
              writeLocalCart(next)
                ? { success: "Agregamos el producto a tu carrito." }
                : { error: "El navegador no permite guardar el carrito." },
            );
          });
        }}
      >
        {variants.length > 0 && (
          <label className="field">
            <span>Variante</span>
            <select
              value={variantId}
              onChange={(event) => {
                setVariantId(event.target.value);
                setLiveStock(undefined);
                setQuantity(1);
                setState({});
              }}
            >
              {variants.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} ·{" "}
                  {new Intl.NumberFormat("es-CL", {
                    style: "currency",
                    currency: "CLP",
                    maximumFractionDigits: 0,
                  }).format(product.price + option.priceAdjustment)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>Cantidad</span>
          <input
            type="number"
            min="1"
            max={available || 1}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            disabled={!available}
          />
        </label>
        <button
          type="submit"
          className="button dark"
          disabled={pending || !available}
        >
          <ShoppingBag size={18} />{" "}
          {pending ? "Agregando…" : "Agregar al carrito"}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="error-text">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="success-text">
          {state.success} <Link href="/carrito">Ver carrito</Link>
        </p>
      )}
    </>
  );
}
