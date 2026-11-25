import { db } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (id.length > 40)
    return Response.json({ error: "Producto no disponible" }, { status: 404 });
  const product = await db.product.findUnique({
    where: { id },
    select: { active: true, stock: true },
  });
  const variantId = new URL(request.url).searchParams.get("variant");
  const variant =
    product?.active && variantId && variantId !== "base"
      ? await db.productVariant.findFirst({
          where: { id: variantId, productId: id, active: true },
          select: { stock: true },
        })
      : null;
  return Response.json(
    {
      stock: product?.active
        ? variantId && variantId !== "base"
          ? (variant?.stock ?? 0)
          : product.stock
        : 0,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
