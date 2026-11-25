import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  cancelOrder,
  placeOrder,
  requestReturn,
  resolveReturn,
} from "../src/lib/commerce";

const hasTestDatabase =
  process.env.DATABASE_URL &&
  new URL(process.env.DATABASE_URL).pathname.endsWith("_test");
describe.skipIf(!hasTestDatabase)("orders in PostgreSQL", () => {
  const db = new PrismaClient();
  const ids: {
    actor?: string;
    competitor?: string;
    product?: string;
    actorAddress?: string;
    competitorAddress?: string;
    variant?: string;
  } = {};
  beforeAll(async () => {
    const suffix = randomUUID();
    const [actor, competitor, product] = await Promise.all([
      db.user.create({
        data: {
          email: `actor-${suffix}@example.test`,
          name: "Actor",
          passwordHash: "unusable",
        },
      }),
      db.user.create({
        data: {
          email: `second-${suffix}@example.test`,
          name: "Second",
          passwordHash: "unusable",
        },
      }),
      db.product.create({
        data: {
          name: "Stock test",
          slug: `stock-${suffix}`,
          description: "Test item",
          category: "DESK",
          price: 9900,
          stock: 1,
          images: [],
        },
      }),
    ]);
    ids.actor = actor.id;
    ids.competitor = competitor.id;
    ids.product = product.id;
    const address = {
      label: "Casa",
      street: "Demo 123",
      city: "Rengo",
      region: "O’Higgins",
    };
    const [a, b] = await Promise.all([
      db.address.create({ data: { ...address, userId: actor.id } }),
      db.address.create({ data: { ...address, userId: competitor.id } }),
    ]);
    ids.actorAddress = a.id;
    ids.competitorAddress = b.id;
    await db.cartItem.createMany({
      data: [actor.id, competitor.id].map((userId) => ({
        userId,
        productId: product.id,
        quantity: 1,
      })),
    });
  });
  afterAll(async () => {
    const users = [ids.actor, ids.competitor].filter(
      (id): id is string => !!id,
    );
    if (users.length)
      await db.$transaction([
        db.order.deleteMany({ where: { userId: { in: users } } }),
        db.user.deleteMany({ where: { id: { in: users } } }),
      ]);
    if (ids.product)
      await db.product.deleteMany({ where: { id: ids.product } });
    await db.$disconnect();
  });

  it("rolls back declines, protects saved addresses and never sells the same unit twice", async () => {
    const makeRequest = (addressId: string) => ({
      key: randomUUID(),
      addressId,
      payment: "approve" as const,
    });
    const one = makeRequest(ids.actorAddress!);
    const two = makeRequest(ids.competitorAddress!);
    await expect(
      placeOrder(db, ids.actor!, { ...one, payment: "decline" }),
    ).rejects.toThrow("rechazado");
    await expect(
      placeOrder(db, ids.actor!, { ...one, addressId: ids.competitorAddress }),
    ).rejects.toThrow("dirección de tu cuenta");
    const purchases = await Promise.allSettled([
      placeOrder(db, ids.actor!, one),
      placeOrder(db, ids.competitor!, two),
    ]);
    expect(
      purchases.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      purchases.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    const [first, second] = purchases;
    const winner =
      first.status === "fulfilled"
        ? first.value
        : second.status === "fulfilled"
          ? second.value
          : undefined;
    const winnerRequest = first.status === "fulfilled" ? one : two;
    expect(winner?.total).toBe(9900);
    expect((await placeOrder(db, winner!.userId, winnerRequest)).id).toBe(
      winner!.id,
    );
    expect(
      await db.product.findUnique({
        where: { id: ids.product },
        select: { stock: true },
      }),
    ).toEqual({ stock: 0 });
    expect(
      await db.order.count({
        where: { items: { some: { productId: ids.product } } },
      }),
    ).toBe(1);
  });

  it("rejects an empty cart after checkout", async () => {
    const winner = await db.order.findFirstOrThrow({
      where: { items: { some: { productId: ids.product } } },
    });
    await expect(
      placeOrder(db, winner.userId, {
        key: randomUUID(),
        addressId:
          winner.userId === ids.actor
            ? ids.actorAddress
            : ids.competitorAddress,
        payment: "approve",
      }),
    ).rejects.toThrow("carrito está vacío");
  });

  it("cancels exactly once and restores stock under concurrent requests", async () => {
    const order = await db.order.findFirstOrThrow({
      where: { items: { some: { productId: ids.product } } },
    });
    const outsider = order.userId === ids.actor ? ids.competitor! : ids.actor!;
    await expect(cancelOrder(db, outsider, order.id)).rejects.toThrow(
      "Pedido no encontrado",
    );
    const results = await Promise.all([
      cancelOrder(db, order.userId, order.id),
      cancelOrder(db, order.userId, order.id),
    ]);
    expect(results.every((result) => result.status === "CANCELLED")).toBe(true);
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: ids.product } }))
        .stock,
    ).toBe(1);
  });

  it("validates and persists the simulated coupon without duplicating checkout", async () => {
    const order = await db.order.findFirstOrThrow({
      where: { items: { some: { productId: ids.product } } },
    });
    await db.cartItem.upsert({
      where: {
        userId_productId_variantId: {
          userId: order.userId,
          productId: ids.product!,
          variantId: "base",
        },
      },
      create: {
        userId: order.userId,
        productId: ids.product!,
        variantId: "base",
        quantity: 1,
      },
      update: { quantity: 1 },
    });
    const addressId =
      order.userId === ids.actor ? ids.actorAddress : ids.competitorAddress;
    const checkout = {
      key: randomUUID(),
      addressId,
      payment: "approve",
      coupon: "demo10",
    };
    await expect(
      placeOrder(db, order.userId, { ...checkout, coupon: "bad" }),
    ).rejects.toThrow("Cupón");
    const result = await placeOrder(db, order.userId, checkout);
    expect(result.total).toBe(8910);
    expect(result.discount).toBe(990);
    expect(result.coupon).toBe("DEMO10");
    expect((await placeOrder(db, order.userId, checkout)).id).toBe(result.id);
  });

  it("checks out an exact variant and restores it once after an approved return", async () => {
    const variant = await db.productVariant.create({
      data: {
        productId: ids.product!,
        name: "Edición azul",
        sku: `BLUE-${randomUUID()}`,
        priceAdjustment: 1100,
        stock: 1,
      },
    });
    ids.variant = variant.id;
    await db.cartItem.deleteMany({ where: { userId: ids.actor } });
    await db.cartItem.create({
      data: {
        userId: ids.actor!,
        productId: ids.product!,
        variantId: variant.id,
        quantity: 1,
      },
    });
    const placed = await placeOrder(db, ids.actor!, {
      key: randomUUID(),
      addressId: ids.actorAddress!,
      payment: "approve",
    });
    const order = await db.order.findUniqueOrThrow({
      where: { id: placed.id },
      include: { items: true },
    });
    expect(order.total).toBe(11000);
    expect(order.items[0]).toMatchObject({
      variantId: variant.id,
      variantName: "Edición azul",
      price: 11000,
    });
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } }))
        .stock,
    ).toBe(0);
    await db.order.update({
      where: { id: order.id },
      data: { status: "DELIVERED" },
    });
    await expect(
      requestReturn(
        db,
        ids.competitor!,
        order.id,
        "No corresponde al pedido recibido.",
      ),
    ).rejects.toThrow("Pedido no encontrado");
    const requested = await requestReturn(
      db,
      ids.actor!,
      order.id,
      "No corresponde al pedido recibido.",
    );
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
    ).toBe("RETURN_REQUESTED");
    const decisions = await Promise.all([
      resolveReturn(db, requested.id, "APPROVED", "Revisión completada"),
      resolveReturn(db, requested.id, "APPROVED", "Revisión completada"),
    ]);
    expect(decisions.every((item) => item.status === "APPROVED")).toBe(true);
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } }))
        .stock,
    ).toBe(1);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
    ).toBe("RETURNED");
  });
});
