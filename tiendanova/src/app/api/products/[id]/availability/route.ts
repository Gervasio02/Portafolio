import { db } from "@/lib/db";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (id.length > 40)
    return Response.json({ error: "Producto no disponible" }, { status: 404 });
  const product = await db.product.findUnique({
    where: { id },
    select: { active: true, stock: true },
  });
  return Response.json(
    { stock: product?.active ? product.stock : 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
