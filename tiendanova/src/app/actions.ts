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
  cancelOrder,
  isPrismaError,
  nextStatus,
  placeOrder,
  requestReturn as requestOrderReturn,
  resolveReturn,
  variantPrice,
} from "@/lib/commerce";
import {
  addressSchema,
  linesSchema,
  lineSchema,
  productSchema,
  registerSchema,
  returnDecisionSchema,
  returnRequestSchema,
  variantSchema,
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
  const { productId, variantId, quantity } = parsed.data;
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
    const key = {
      userId_productId_variantId: { userId: user.id, productId, variantId },
    };
    const [product, existing, variant] = await Promise.all([
      tx.product.findFirst({ where: { id: productId, active: true } }),
      tx.cartItem.findUnique({ where: key }),
      variantId === "base"
        ? null
        : tx.productVariant.findFirst({
            where: { id: variantId, productId, active: true },
          }),
    ]);
    const total = (existing?.quantity ?? 0) + quantity;
    const stock = variantId === "base" ? product?.stock : variant?.stock;
    if (!product || stock === undefined || total > stock || total > 25)
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
      create: { userId: user.id, productId, variantId, quantity },
      update: { quantity: total },
    });
    return { success: "Agregamos el producto a tu carrito." };
  });
  revalidatePath("/carrito");
  return result;
}

export async function updateCart(
  productId: string,
  variantId: string,
  quantity: number,
): Promise<FormState> {
  const user = await requireUser();
  if (
    typeof productId !== "string" ||
    !productId ||
    productId.length > 40 ||
    typeof variantId !== "string" ||
    !variantId ||
    variantId.length > 40 ||
    !Number.isInteger(quantity) ||
    quantity < 0 ||
    quantity > 25
  )
    return { error: "Cantidad no válida." };
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
    if (!quantity) {
      await tx.cartItem.deleteMany({
        where: { userId: user.id, productId, variantId },
      });
      return { success: "Producto eliminado." };
    }
    const [product, variant] = await Promise.all([
      tx.product.findFirst({ where: { id: productId, active: true } }),
      variantId === "base"
        ? null
        : tx.productVariant.findFirst({
            where: { id: variantId, productId, active: true },
          }),
    ]);
    const stock = variantId === "base" ? product?.stock : variant?.stock;
    if (!product || stock === undefined || quantity > stock)
      return { error: "La cantidad supera el stock actual." };
    await tx.cartItem.updateMany({
      where: { userId: user.id, productId, variantId },
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
    const variants = await tx.productVariant.findMany({
      where: {
        active: true,
        id: {
          in: parsed.data
            .map((line) => line.variantId)
            .filter((id) => id !== "base"),
        },
      },
    });
    const current = await tx.cartItem.findMany({ where: { userId: user.id } });
    let remaining = 20 - current.length;
    let ignored = 0;
    for (const line of parsed.data) {
      const product = products.find((product) => product.id === line.productId);
      const variant =
        line.variantId === "base"
          ? null
          : variants.find(
              (candidate) =>
                candidate.id === line.variantId &&
                candidate.productId === line.productId,
            );
      const previous = current.find(
        (item) =>
          item.productId === line.productId &&
          item.variantId === line.variantId,
      );
      const stock = line.variantId === "base" ? product?.stock : variant?.stock;
      if (
        !product ||
        stock === undefined ||
        stock < 1 ||
        (!previous && remaining <= 0)
      ) {
        ignored++;
        continue;
      }
      const wanted = (previous?.quantity ?? 0) + line.quantity;
      const quantity = Math.min(wanted, stock, 25);
      if (quantity !== wanted) ignored++;
      const key = {
        userId_productId_variantId: {
          userId: user.id,
          productId: line.productId,
          variantId: line.variantId,
        },
      };
      await tx.cartItem.upsert({
        where: key,
        create: {
          userId: user.id,
          productId: line.productId,
          variantId: line.variantId,
          quantity,
        },
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
  if (typeof id === "string" && id) {
    const cheapestVariant = await db.productVariant.findFirst({
      where: { productId: id, active: true },
      orderBy: { priceAdjustment: "asc" },
      select: { priceAdjustment: true },
    });
    if (cheapestVariant) {
      try {
        variantPrice(parsed.data.price, cheapestVariant.priceAdjustment);
      } catch (error) {
        if (error instanceof CommerceError)
          return {
            error:
              "El precio dejaría una variante activa sin un valor final válido.",
          };
        throw error;
      }
    }
  }
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

export async function saveVariant(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  await requireAdmin();
  const id = form.get("id");
  const parsed = variantSchema.safeParse({
    ...object(form),
    active: form.get("active") === "on",
  });
  if (!parsed.success)
    return { error: "Revisa el nombre, SKU, ajuste de precio y stock." };
  const product = await db.product.findUnique({
    where: { id: parsed.data.productId },
    select: { price: true },
  });
  try {
    if (!product) return { error: "El producto no existe." };
    variantPrice(product.price, parsed.data.priceAdjustment);
  } catch (error) {
    if (error instanceof CommerceError)
      return { error: "La variante debe conservar un precio final positivo." };
    throw error;
  }
  try {
    if (typeof id === "string" && id) {
      const changed = await db.productVariant.updateMany({
        where: { id, productId: parsed.data.productId },
        data: parsed.data,
      });
      if (!changed.count) return { error: "La variante no existe." };
    } else await db.productVariant.create({ data: parsed.data });
  } catch (error) {
    if (isPrismaError(error, "P2002"))
      return { error: "El SKU ya pertenece a otra variante." };
    if (isPrismaError(error, "P2025"))
      return { error: "La variante no existe." };
    throw error;
  }
  revalidatePath("/admin");
  revalidatePath("/", "layout");
  return { success: "Variante guardada." };
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

export async function cancelMyOrder(form: FormData) {
  const user = await requireUser();
  const id = form.get("id");
  if (typeof id !== "string" || id.length > 40) return;
  try {
    await cancelOrder(db, user.id, id);
  } catch (error) {
    if (!(error instanceof CommerceError)) throw error;
  }
  revalidatePath("/admin");
  revalidatePath("/cuenta", "layout");
  revalidatePath(`/cuenta/pedidos/${id}`);
  revalidatePath("/");
}

export async function requestMyReturn(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = returnRequestSchema.safeParse(object(form));
  if (!parsed.success)
    return {
      error: "Describe el motivo de la devolución (10 a 500 caracteres).",
    };
  try {
    await requestOrderReturn(
      db,
      user.id,
      parsed.data.orderId,
      parsed.data.reason,
    );
  } catch (error) {
    if (error instanceof CommerceError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/cuenta/pedidos/${parsed.data.orderId}`);
  revalidatePath("/admin");
  return { success: "Solicitud enviada para revisión." };
}

export async function decideReturn(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = returnDecisionSchema.safeParse(object(form));
  if (!parsed.success) return { error: "La decisión no es válida." };
  try {
    await resolveReturn(
      db,
      parsed.data.requestId,
      parsed.data.decision,
      parsed.data.adminNote,
    );
  } catch (error) {
    if (error instanceof CommerceError) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin");
  revalidatePath("/cuenta", "layout");
  return {
    success:
      parsed.data.decision === "APPROVED"
        ? "Devolución aprobada e inventario repuesto."
        : "Devolución rechazada.",
  };
}
