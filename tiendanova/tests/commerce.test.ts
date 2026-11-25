import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  calculateTotal,
  CommerceError,
  isPrismaError,
  money,
  nextStatus,
  placeOrder,
  variantPrice,
} from "../src/lib/commerce";
import {
  addressSchema,
  checkoutSchema,
  filterSchema,
  lineSchema,
  linesSchema,
  productSchema,
  registerSchema,
} from "../src/lib/validation";
import {
  parseCart,
  readCartSnapshot,
  readServerSnapshot,
  subscribeCart,
  writeLocalCart,
} from "../src/lib/cart-storage";

describe("local guest cart", () => {
  const line = {
    productId: "product-id",
    variantId: "base",
    slug: "lamp",
    name: "Lamp",
    stock: 10,
    price: 34990,
    image: "/products/lamp.jpg",
    quantity: 2,
  };

  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => data.get(key),
      setItem: (key: string, value: string) => data.set(key, value),
    });
    vi.stubGlobal("window", new EventTarget());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("validates, stores and broadcasts changes", () => {
    const change = vi.fn();
    const unsubscribe = subscribeCart(change);
    expect(parseCart(readServerSnapshot())).toEqual([]);
    expect(parseCart(readCartSnapshot())).toEqual([]);
    expect(writeLocalCart([line])).toBe(true);
    expect(parseCart(readCartSnapshot())).toEqual([line]);
    expect(change).toHaveBeenCalledOnce();
    unsubscribe();
    writeLocalCart([]);
    expect(change).toHaveBeenCalledOnce();
  });
  it("ignores malformed and untrusted localStorage values", () => {
    expect(parseCart("legacy data")).toEqual([]);
    expect(parseCart(JSON.stringify([{ ...line, quantity: -3 }]))).toEqual([]);
    expect(parseCart(JSON.stringify([line, line]))).toEqual([]);
    expect(
      parseCart(
        JSON.stringify([{ ...line, image: "https://example.test/unsafe.png" }]),
      ),
    ).toEqual([]);
  });
  it("works even when browser storage is denied", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(readCartSnapshot()).toBe("[]");
    expect(writeLocalCart([line])).toBe(false);
  });
});

describe("commerce invariants", () => {
  it("rejects a variant whose adjustment produces a non-positive price", () => {
    expect(variantPrice(9990, 1100)).toBe(11090);
    expect(() => variantPrice(9990, -9990)).toThrow(CommerceError);
  });

  it("computes whole Chilean pesos without floating-point arithmetic", () => {
    expect(
      calculateTotal([
        { price: 34990, quantity: 2 },
        { price: 9990, quantity: 1 },
      ]),
    ).toBe(79970);
    expect(calculateTotal([])).toBe(0);
    expect(money(34990)).toContain("34.990");
  });
  it("only moves shipments forward", () => {
    expect(nextStatus("PAID")).toBe("SHIPPED");
    expect(nextStatus("SHIPPED")).toBe("DELIVERED");
    expect(nextStatus("DELIVERED")).toBeNull();
  });
  it("recognizes a specific database failure", () => {
    expect(
      isPrismaError(
        new Prisma.PrismaClientKnownRequestError("duplicate", {
          code: "P2002",
          clientVersion: "6",
        }),
        "P2002",
      ),
    ).toBe(true);
    expect(isPrismaError(new Error("different type"), "P2002")).toBe(false);
  });
  it("validates external data before starting a transaction", async () => {
    const noDatabase = {} as PrismaClient;
    await expect(
      placeOrder(noDatabase, "user", { key: "bad" }),
    ).rejects.toThrow(CommerceError);
    expect(lineSchema.safeParse({ productId: "p", quantity: 26 }).success).toBe(
      false,
    );
    expect(
      linesSchema.safeParse([
        { productId: "p", quantity: 1 },
        { productId: "p", quantity: 2 },
      ]).success,
    ).toBe(false);
    expect(
      checkoutSchema.safeParse({
        key: randomUUID(),
        addressId: "a",
        payment: "approve",
      }).success,
    ).toBe(true);
    expect(
      addressSchema.safeParse({
        label: "Casa",
        street: "Plaza 18",
        city: "Rengo",
        region: "O’Higgins",
      }).success,
    ).toBe(true);
    expect(
      registerSchema.safeParse({
        name: "Demo",
        email: "TEST@example.test",
        password: "much0-test!!",
      }).data?.email,
    ).toBe("test@example.test");
    expect(
      registerSchema.safeParse({
        name: "Demo",
        email: "test@example.test",
        password: "🔑".repeat(20),
      }).success,
    ).toBe(false);
    expect(
      productSchema.safeParse({
        name: "Lamp",
        slug: "invalid/slug",
        description: "An example lamp",
        category: "LIGHTING",
        price: 1000,
        stock: 1,
        images: ["/products/lamp.jpg"],
        active: true,
      }).success,
    ).toBe(false);
    expect(
      filterSchema.parse({ category: "", min: "", max: "30000", page: "-10" }),
    ).toEqual({
      q: "",
      category: undefined,
      min: undefined,
      max: 30000,
      sort: "recent",
      page: 1,
    });
  });
});
