import { z } from "zod";

const item = z.object({
  productId: z.string().min(1).max(40),
  variantId: z.string().min(1).max(40).default("base"),
  variantName: z.string().max(60).optional(),
  slug: z.string().max(80),
  name: z.string().max(80),
  image: z.string().regex(/^\/products\/[\w.-]+\.(?:png|jpe?g|webp)$/i),
  price: z.number().int().min(1).max(1_000_000),
  stock: z.number().int().min(0),
  quantity: z.number().int().min(1).max(25),
});
const list = z
  .array(item)
  .max(20)
  .refine(
    (items) =>
      new Set(items.map((line) => `${line.productId}:${line.variantId}`))
        .size === items.length,
  );
export type LocalItem = z.infer<typeof item>;
const KEY = "tiendanova.cart.v1";
const EMPTY = "[]";

export function readCartSnapshot() {
  try {
    return localStorage.getItem(KEY) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}
export const readServerSnapshot = () => EMPTY;
export function parseCart(raw: string): LocalItem[] {
  try {
    const result = list.safeParse(JSON.parse(raw));
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}
export function subscribeCart(change: () => void) {
  window.addEventListener("storage", change);
  window.addEventListener(KEY, change);
  return () => {
    window.removeEventListener("storage", change);
    window.removeEventListener(KEY, change);
  };
}
export function writeLocalCart(lines: LocalItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
    window.dispatchEvent(new Event(KEY));
    return true;
  } catch {
    return false;
  }
}
