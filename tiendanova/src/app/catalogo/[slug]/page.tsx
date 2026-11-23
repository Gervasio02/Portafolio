import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AddProduct } from "@/components/add-product";
import { Gallery } from "@/components/gallery";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { categoryNames } from "@/lib/validation";
import { money } from "@/lib/commerce";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await db.product.findFirst({
    where: { slug, active: true },
    select: { name: true, description: true },
  });
  return product
    ? { title: product.name, description: product.description }
    : { title: "Producto no disponible" };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [product, user] = await Promise.all([
    db.product.findFirst({ where: { slug, active: true } }),
    currentUser(),
  ]);
  if (!product) notFound();
  return (
    <section className="wrap workpage">
      <Link href="/#catalogo" className="text-link back-link">
        <ArrowLeft size={17} /> Volver al catálogo
      </Link>
      <div className="detail-grid">
        <Gallery images={product.images} name={product.name} />
        <div className="detail-copy">
          <p className="eyebrow">{categoryNames[product.category]}</p>
          <h1>{product.name}</h1>
          <p className="detail-price">{money(product.price)}</p>
          <p className="muted">{product.description}</p>
          <AddProduct
            key={product.id}
            product={{
              productId: product.id,
              slug: product.slug,
              name: product.name,
              image: product.images[0] ?? "/products/workspace.jpg",
              price: product.price,
              stock: product.stock,
            }}
            isSignedIn={!!user}
          />
        </div>
      </div>
    </section>
  );
}
