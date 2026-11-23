import { z } from "zod";

export const categories = ["DESK", "LIGHTING", "ACCESSORIES"] as const;
export const categoryNames = {
  DESK: "Escritorio",
  LIGHTING: "Iluminación",
  ACCESSORIES: "Accesorios",
};
export const statusNames = {
  PAID: "Pagado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
};

export const email = z.email().max(254).trim().toLowerCase();
const password = z
  .string()
  .min(10)
  .max(72)
  .refine((value) => new TextEncoder().encode(value).length <= 72);
export const signInSchema = z.object({ email, password });
export const registerSchema = signInSchema.extend({
  name: z.string().trim().min(2).max(80),
});
export const addressSchema = z.object({
  label: z.string().trim().min(2).max(50),
  street: z.string().trim().min(5).max(130),
  city: z.string().trim().min(2).max(90),
  region: z.string().trim().min(2).max(90),
});
export const lineSchema = z.object({
  productId: z.string().min(1).max(40),
  quantity: z.number().int().min(1).max(25),
});
export const linesSchema = z
  .array(lineSchema)
  .max(20)
  .refine(
    (items) =>
      new Set(items.map((item) => item.productId)).size === items.length,
  );
export const checkoutSchema = z.object({
  key: z.uuid(),
  addressId: z.string().min(1).max(40),
  payment: z.enum(["approve", "decline"]),
});
export const productSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(10).max(500),
  category: z.enum(categories),
  price: z.coerce.number().int().min(1).max(1_000_000),
  stock: z.coerce.number().int().min(0).max(100_000),
  images: z
    .array(z.string().regex(/^\/products\/[\w.-]+\.(?:png|jpe?g|webp)$/i))
    .min(1)
    .max(5),
  active: z.boolean(),
});

const optionalPrice = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.coerce.number().int().min(0).max(1_000_000).optional(),
);
export const filterSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  category: z.enum(categories).optional().catch(undefined),
  min: optionalPrice.catch(undefined),
  max: optionalPrice.catch(undefined),
  sort: z.enum(["recent", "price-asc", "price-desc", "name"]).catch("recent"),
  page: z.coerce.number().int().min(1).max(10000).catch(1),
});

export type Line = z.infer<typeof lineSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
