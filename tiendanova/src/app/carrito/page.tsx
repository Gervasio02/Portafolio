import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { currentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { Cart } from "@/components/cart";
import { AddressForm, CheckoutForm } from "@/components/forms";

export const metadata: Metadata = {
  title: "Carrito",
  robots: { index: false },
};

export default async function CartPage() {
  const user = await currentUser();
  const [cart, addresses] = user
    ? await Promise.all([
        db.cartItem.findMany({
          where: { userId: user.id },
          include: { product: true },
          orderBy: { productId: "asc" },
        }),
        db.address.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          select: { id: true, label: true, street: true },
        }),
      ])
    : [[], []];
  const items = cart.map(({ product, quantity }) => ({
    productId: product.id,
    slug: product.slug,
    name: product.name,
    image: product.images[0] ?? "/products/workspace.jpg",
    price: product.price,
    stock: product.stock,
    quantity,
    active: product.active,
  }));
  return (
    <section className="wrap workpage">
      <Link href="/#catalogo" className="text-link back-link">
        <ArrowLeft size={16} /> Seguir explorando
      </Link>
      <p className="eyebrow">Tu selección</p>
      <h1>Carrito</h1>
      <Cart signedIn={!!user} items={items}>
        {addresses.length ? (
          <CheckoutForm
            checkoutKey={randomUUID()}
            addresses={addresses}
            disabled={items.some(
              (line) => !line.active || line.quantity > line.stock,
            )}
          />
        ) : (
          <details open>
            <summary>Agrega una dirección de prueba</summary>
            <AddressForm />
          </details>
        )}
      </Cart>
    </section>
  );
}
