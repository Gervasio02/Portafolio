import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { filterSchema } from "./validation";

const pageSize = 6;
export async function loadCatalog(
  search: Record<string, string | string[] | undefined>,
) {
  const raw = Object.fromEntries(
    Object.entries(search).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
  const filters = filterSchema.parse(raw);
  const limits =
    filters.min !== undefined &&
    filters.max !== undefined &&
    filters.min > filters.max
      ? { gte: filters.max, lte: filters.min }
      : { gte: filters.min, lte: filters.max };
  const where: Prisma.ProductWhereInput = {
    active: true,
    category: filters.category,
    price: limits,
    OR: filters.q
      ? [
          { name: { contains: filters.q, mode: "insensitive" } },
          { description: { contains: filters.q, mode: "insensitive" } },
        ]
      : undefined,
  };
  const ordering: Record<
    typeof filters.sort,
    Prisma.ProductOrderByWithRelationInput
  > = {
    recent: { createdAt: "desc" },
    "price-asc": { price: "asc" },
    "price-desc": { price: "desc" },
    name: { name: "asc" },
  };
  const count = await db.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const page = Math.min(filters.page, totalPages);
  const products = await db.product.findMany({
    where,
    orderBy: [ordering[filters.sort], { id: "asc" }],
    take: pageSize,
    skip: (page - 1) * pageSize,
  });
  return { products, filters, count, page, totalPages };
}
