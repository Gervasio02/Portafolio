"use server";

import { AuthError } from "next-auth";
import { hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { currentUser, requireAdmin, requireUser } from "@/lib/session";
import {
  CommerceError,
  isPrismaError,
  nextStatus,
  placeOrder,
} from "@/lib/commerce";
import {
  addressSchema,
  linesSchema,
  lineSchema,
  productSchema,
  registerSchema,
} from "@/lib/validation";

export type FormState = { error?: string; success?: string };
const object = (form: FormData) => Object.fromEntries(form);

export async function login(_: FormState, form: FormData): Promise<FormState> {
  try {
    await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirectTo: form.get("returnTo") === "carrito" ? "/carrito" : "/",
    });
  } catch (error) {
    if (error instanceof AuthError && error.type === "CredentialsSignin")
      return { error: "Correo o contraseña incorrectos." };
    throw error;
  }
  return {};
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}

export async function register(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const registration = registerSchema.safeParse(object(form));
  if (!registration.success)
    return {
      error:
        "Usa un nombre, un correo válido y una contraseña de 10 a 72 caracteres.",
    };
  const { name, email, password } = registration.data;
  try {
    await db.user.create({
      data: { name, email, passwordHash: await hash(password, 12) },
    });
  } catch (error) {
    if (isPrismaError(error, "P2002"))
      return { error: "Este correo ya está registrado." };
    throw error;
  }
  await signIn("credentials", {
    email,
    password,
    redirectTo: form.get("returnTo") === "carrito" ? "/carrito" : "/",
  });
  return {};
}

export async function addToCart(input: unknown): Promise<FormState> {
  const user = await currentUser();
  if (!user)
    return { error: "Inicia sesión otra vez para actualizar tu carrito." };
  const parsed = lineSchema.safeParse(input);
  if (!parsed.success) return { error: "Selecciona una cantidad válida." };
  const { productId, quantity } = parsed.data;
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
    const key = { userId_productId: { userId: user.id, productId } };
    const [product, existing] = await Promise.all([
      tx.product.findFirst({ where: { id: productId, active: true } }),
      tx.cartItem.findUnique({ where: key }),
    ]);
    const total = (existing?.quantity ?? 0) + quantity;
    if (!product || total > product.stock || total > 25)
      return { error: "No hay unidades suficientes para esa cantidad." };
    if (
      !existing &&
      (await tx.cartItem.count({ where: { userId: user.id } })) >= 20
    )
      return {
        error: "Puedes tener hasta 20 productos diferentes en tu carrito.",
      };
    await tx.cartItem.upsert({
      where: key,
      create: { userId: user.id, productId, quantity },
      update: { quantity: total },
    });
    return { success: "Agregamos el producto a tu carrito." };
  });
  revalidatePath("/carrito");
  return result;
}

export async function updateCart(
  productId: string,
  quantity: number,
): Promise<FormState> {
  const user = await requireUser();
  if (
    typeof productId !== "string" ||
    !productId ||
    productId.length > 40 ||
    !Number.isInteger(quantity) ||
    quantity < 0 ||
    quantity > 25
  )
    return { error: "Cantidad no válida." };
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
    if (!quantity) {
      await tx.cartItem.deleteMany({ where: { userId: user.id, productId } });
      return { success: "Producto eliminado." };
    }
    const product = await tx.product.findFirst({
      where: { id: productId, active: true },
    });
    if (!product || quantity > product.stock)
      return { error: "La cantidad supera el stock actual." };
    await tx.cartItem.updateMany({
      where: { userId: user.id, productId },
      data: { quantity },
    });
    return { success: "Cantidad actualizada." };
  });
  revalidatePath("/carrito");
  return result;
}

export async function importCart(input: unknown): Promise<FormState> {
  const user = await requireUser();
  const parsed = linesSchema.safeParse(input);
  if (!parsed.success || !parsed.data.length)
    return { error: "No encontramos un carrito válido para importar." };
  const ignored = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
    const products = await tx.product.findMany({
      where: {
        active: true,
        id: { in: parsed.data.map((line) => line.productId) },
      },
    });
    const current = await tx.cartItem.findMany({ where: { userId: user.id } });
    let remaining = 20 - current.length;
    let ignored = 0;
    for (const line of parsed.data) {
      const product = products.find((product) => product.id === line.productId);
      const previous = current.find(
        (item) => item.productId === line.productId,
      );
      if (!product || product.stock < 1 || (!previous && remaining <= 0)) {
        ignored++;
        continue;
      }
      const wanted = (previous?.quantity ?? 0) + line.quantity;
      const quantity = Math.min(wanted, product.stock, 25);
      if (quantity !== wanted) ignored++;
      const key = {
        userId_productId: { userId: user.id, productId: line.productId },
      };
      await tx.cartItem.upsert({
        where: key,
        create: { userId: user.id, productId: line.productId, quantity },
        update: { quantity },
      });
      if (!previous) remaining--;
    }
    return ignored;
  });
  revalidatePath("/carrito");
  return {
    success: ignored
      ? "Carrito importado con ajustes de disponibilidad."
      : "Carrito local importado.",
  };
}

export async function saveAddress(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = addressSchema.safeParse(object(form));
  if (!parsed.success)
    return { error: "Completa la identificación, calle, comuna y región." };
  const count = await db.address.count({ where: { userId: user.id } });
  if (count >= 12)
    return { error: "Elimina una dirección antes de agregar otra." };
  await db.address.create({ data: { userId: user.id, ...parsed.data } });
  revalidatePath("/cuenta");
  revalidatePath("/carrito");
  return { success: "Dirección guardada." };
}

export async function removeAddress(form: FormData) {
  const user = await requireUser();
  const id = form.get("id");
  if (typeof id !== "string") return;
  await db.address.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/cuenta");
  revalidatePath("/carrito");
}

export async function checkout(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser();
  let order;
  try {
    order = await placeOrder(db, user.id, object(form));
  } catch (error) {
    if (error instanceof CommerceError) return { error: error.message };
    console.error("checkout.error", {
      code: error instanceof Error ? error.name : "unknown",
    });
    return {
      error:
        "No pudimos confirmar la compra. Puedes reintentar de forma segura.",
    };
  }
  // A console event represents the demo email without sending mail or exposing addresses.
  console.info("demo.purchase_confirmation", { orderId: order.id });
  revalidatePath("/carrito");
  revalidatePath("/");
  revalidatePath("/cuenta", "layout");
  redirect(`/cuenta/pedidos/${order.id}?confirmado=1`);
}

export async function saveProduct(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  await requireAdmin();
  const id = form.get("id");
  const images =
    typeof form.get("images") === "string"
      ? String(form.get("images"))
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
      : [];
  const parsed = productSchema.safeParse({
    ...object(form),
    images,
    active: form.get("active") === "on",
  });
  if (!parsed.success)
    return {
      error:
        "Revisa los campos. Las imágenes deben estar dentro de /products/.",
    };
  try {
    if (typeof id === "string" && id)
      await db.product.update({ where: { id }, data: parsed.data });
    else await db.product.create({ data: parsed.data });
  } catch (error) {
    if (isPrismaError(error, "P2002"))
      return { error: "Ese identificador de catálogo ya existe." };
    if (isPrismaError(error, "P2025"))
      return { error: "El producto no existe." };
    throw error;
  }
  revalidatePath("/");
  revalidatePath("/admin");
  return { success: "Producto guardado." };
}

export async function archiveProduct(form: FormData) {
  await requireAdmin();
  const id = form.get("id");
  if (typeof id !== "string") return;
  await db.product.updateMany({ where: { id }, data: { active: false } });
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function progressOrder(form: FormData) {
  await requireAdmin();
  const id = form.get("id");
  if (typeof id !== "string") return;
  const order = await db.order.findUnique({
    where: { id },
    select: { status: true },
  });
  const expected = form.get("expected");
  if (!order || order.status !== expected) return;
  const status = nextStatus(order.status);
  if (!status) return;
  await db.order.updateMany({
    where: { id, status: order.status },
    data: { status },
  });
  revalidatePath("/admin");
  revalidatePath("/cuenta", "layout");
}
