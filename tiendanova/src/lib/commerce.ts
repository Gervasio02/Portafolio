import { Prisma, type PrismaClient } from "@prisma/client";
import { checkoutSchema, type AddressInput } from "./validation";

export class CommerceError extends Error {}

export const money = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);

export function calculateTotal(lines: { price: number; quantity: number }[]) {
  return lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
}

export function nextStatus(status: "PAID" | "SHIPPED" | "DELIVERED") {
  if (status === "PAID") return "SHIPPED";
  if (status === "SHIPPED") return "DELIVERED";
  return null;
}

export function isPrismaError(error: unknown, code: string) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

export async function placeOrder(
  db: PrismaClient,
  userId: string,
  raw: unknown,
) {
  const request = checkoutSchema.safeParse(raw);
  if (!request.success)
    throw new CommerceError("Revisa la dirección y el método de pago.");
  const { key, addressId, payment } = request.data;
  const where = { userId_checkoutKey: { userId, checkoutKey: key } };
  const previous = await db.order.findUnique({ where });
  if (previous) return previous;
  if (payment === "decline")
    throw new CommerceError(
      "El pago simulado fue rechazado. El carrito sigue disponible.",
    );

  try {
    return await db.$transaction(async (tx) => {
      // A database transaction lock serializes each customer's cart and checkout.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const existing = await tx.order.findUnique({ where });
      if (existing) return existing;

      const saved = await tx.address.findFirst({
        where: { id: addressId, userId },
      });
      if (!saved)
        throw new CommerceError("Selecciona una dirección de tu cuenta.");
      const cart = await tx.cartItem.findMany({
        where: { userId },
        orderBy: { productId: "asc" },
      });
      if (!cart.length) throw new CommerceError("El carrito está vacío.");
      if (
        cart.length > 20 ||
        cart.some(({ quantity }) => quantity < 1 || quantity > 25)
      ) {
        throw new CommerceError("Revisa las cantidades del carrito.");
      }

      const items: {
        productId: string;
        name: string;
        price: number;
        quantity: number;
      }[] = [];
      for (const line of cart) {
        try {
          // PostgreSQL rechecks stock after acquiring the row lock. A loser rolls back the whole purchase.
          const product = await tx.product.update({
            where: {
              id: line.productId,
              active: true,
              stock: { gte: line.quantity },
            },
            data: { stock: { decrement: line.quantity } },
            select: { name: true, price: true },
          });
          items.push({
            productId: line.productId,
            quantity: line.quantity,
            ...product,
          });
        } catch (error) {
          if (!isPrismaError(error, "P2025")) throw error;
          throw new CommerceError(
            "Una pieza cambió de disponibilidad. Revisa el carrito.",
          );
        }
      }

      const address: AddressInput = {
        label: saved.label,
        street: saved.street,
        city: saved.city,
        region: saved.region,
      };
      const order = await tx.order.create({
        data: {
          userId,
          checkoutKey: key,
          total: calculateTotal(items),
          address,
          items: { create: items },
        },
      });
      await tx.cartItem.deleteMany({ where: { userId } });
      return order;
    });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      const existing = await db.order.findUnique({ where });
      if (existing) return existing;
    }
    throw error;
  }
}
