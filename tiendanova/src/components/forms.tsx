"use client";

import { useActionState } from "react";
import { ArrowRight, CreditCard } from "lucide-react";
import {
  checkout,
  login,
  register,
  saveAddress,
  saveProduct,
  saveVariant,
  requestMyReturn,
  decideReturn,
  type FormState,
} from "@/app/actions";
import { categories, categoryNames } from "@/lib/validation";
import type { Address, Product, ProductVariant } from "@prisma/client";

const empty: FormState = {};

export function Feedback({ state }: { state: FormState }) {
  if (state.error)
    return (
      <p role="alert" className="error-text">
        {state.error}
      </p>
    );
  if (state.success)
    return (
      <p role="status" className="success-text">
        {state.success}
      </p>
    );
  return null;
}

export function AuthForm({
  mode,
  returnTo,
}: {
  mode: "login" | "register";
  returnTo?: string;
}) {
  const [state, action, pending] = useActionState(
    mode === "login" ? login : register,
    empty,
  );
  return (
    <form action={action} className="form-stack">
      <input type="hidden" name="returnTo" value={returnTo || ""} />
      {mode === "register" && (
        <label className="field">
          <span>Nombre</span>
          <input
            name="name"
            required
            minLength={2}
            maxLength={80}
            autoComplete="name"
          />
        </label>
      )}
      <label className="field">
        <span>Correo electrónico</span>
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
        />
      </label>
      <label className="field">
        <span>Contraseña</span>
        <input
          name="password"
          type="password"
          required
          minLength={10}
          maxLength={72}
          autoComplete={
            mode === "register" ? "new-password" : "current-password"
          }
        />
      </label>
      {mode === "register" && (
        <p className="muted small">
          Usa al menos 10 caracteres. Esta tienda es una demo.
        </p>
      )}
      <Feedback state={state} />
      <button className="button dark" disabled={pending}>
        {pending
          ? "Cargando…"
          : mode === "register"
            ? "Crear cuenta"
            : "Entrar"}
        <ArrowRight size={18} />
      </button>
    </form>
  );
}

export function AddressForm() {
  const [state, action, pending] = useActionState(saveAddress, empty);
  return (
    <form action={action} className="form-stack">
      <label className="field">
        <span>Nombre de la dirección</span>
        <input
          name="label"
          required
          minLength={2}
          maxLength={50}
          placeholder="Ejemplo: Casa"
        />
      </label>
      <label className="field">
        <span>Calle y número</span>
        <input
          name="street"
          required
          minLength={5}
          maxLength={130}
          autoComplete="street-address"
        />
      </label>
      <div className="form-pair">
        <label className="field">
          <span>Comuna</span>
          <input
            name="city"
            required
            minLength={2}
            maxLength={90}
            autoComplete="address-level2"
          />
        </label>
        <label className="field">
          <span>Región</span>
          <input
            name="region"
            required
            minLength={2}
            maxLength={90}
            autoComplete="address-level1"
          />
        </label>
      </div>
      <Feedback state={state} />
      <button type="submit" className="button outline" disabled={pending}>
        {pending ? "Guardando…" : "Guardar dirección"}
      </button>
    </form>
  );
}

export function CheckoutForm({
  checkoutKey,
  addresses,
  disabled,
}: {
  checkoutKey: string;
  addresses: Pick<Address, "id" | "label" | "street">[];
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(checkout, empty);
  return (
    <form action={action} className="form-stack">
      <input type="hidden" name="key" value={checkoutKey} />
      <label>
        Cupón de prueba (opcional)
        <input name="coupon" maxLength={30} placeholder="DEMO10" />
      </label>
      <p>
        DEMO10 descuenta un 10 % del subtotal. El total definitivo se confirma
        al finalizar la compra simulada.
      </p>
      <label className="field">
        <span>Dirección de entrega</span>
        <select name="addressId" required defaultValue="">
          <option value="" disabled>
            Selecciona una dirección
          </option>
          {addresses.map((address) => (
            <option key={address.id} value={address.id}>
              {address.label} · {address.street}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Resultado del pago de prueba</span>
        <select name="payment" defaultValue="approve">
          <option value="approve">Aprobar pago</option>
          <option value="decline">Rechazar pago</option>
        </select>
      </label>
      <Feedback state={state} />
      <button
        type="submit"
        className="button dark full"
        disabled={disabled || pending}
      >
        <CreditCard size={19} /> {pending ? "Confirmando…" : "Pagar (simulado)"}
      </button>
    </form>
  );
}

export function ProductForm({
  product,
}: {
  product?: Pick<
    Product,
    | "id"
    | "name"
    | "slug"
    | "description"
    | "category"
    | "price"
    | "stock"
    | "images"
    | "active"
  >;
}) {
  const [state, action, pending] = useActionState(saveProduct, empty);
  return (
    <form action={action} className="form-stack">
      <input type="hidden" name="id" value={product?.id ?? ""} />
      <div className="form-pair">
        <label className="field">
          <span>Nombre</span>
          <input
            name="name"
            required
            minLength={2}
            maxLength={80}
            defaultValue={product?.name}
          />
        </label>
        <label className="field">
          <span>Identificador URL</span>
          <input
            name="slug"
            required
            maxLength={80}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            defaultValue={product?.slug}
            placeholder="ejemplo-lampara"
          />
        </label>
      </div>
      <label className="field">
        <span>Descripción</span>
        <textarea
          name="description"
          required
          minLength={10}
          maxLength={500}
          rows={2}
          defaultValue={product?.description}
        />
      </label>
      <div className="form-triple">
        <label className="field">
          <span>Categoría</span>
          <select name="category" defaultValue={product?.category ?? "DESK"}>
            {categories.map((category) => (
              <option key={category} value={category}>
                {categoryNames[category]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Precio (CLP)</span>
          <input
            name="price"
            type="number"
            min="1"
            max="1000000"
            required
            defaultValue={product?.price}
          />
        </label>
        <label className="field">
          <span>Stock</span>
          <input
            name="stock"
            type="number"
            min="0"
            max="100000"
            required
            defaultValue={product?.stock}
          />
        </label>
      </div>
      <label className="field">
        <span>Imágenes del catálogo (una ruta por línea)</span>
        <textarea
          name="images"
          required
          rows={2}
          defaultValue={product?.images.join("\n") ?? "/products/workspace.jpg"}
        />
      </label>
      <label className="checkbox">
        <input
          name="active"
          type="checkbox"
          defaultChecked={product?.active ?? true}
        />{" "}
        Visible en el catálogo
      </label>
      <Feedback state={state} />
      <button type="submit" className="button dark" disabled={pending}>
        {pending ? "Guardando…" : "Guardar producto"}
      </button>
    </form>
  );
}

export function VariantForm({
  productId,
  variant,
}: {
  productId: string;
  variant?: Pick<
    ProductVariant,
    "id" | "name" | "sku" | "priceAdjustment" | "stock" | "active"
  >;
}) {
  const [state, action, pending] = useActionState(saveVariant, empty);
  return (
    <form action={action} className="form-stack">
      <input type="hidden" name="id" value={variant?.id ?? ""} />
      <input type="hidden" name="productId" value={productId} />
      <div className="form-pair">
        <label className="field">
          <span>Nombre de variante</span>
          <input
            name="name"
            required
            maxLength={60}
            defaultValue={variant?.name}
            placeholder="Ejemplo: Negro"
          />
        </label>
        <label className="field">
          <span>SKU</span>
          <input
            name="sku"
            required
            maxLength={40}
            pattern="[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*"
            defaultValue={variant?.sku}
            placeholder="LAMP-NEGRA"
          />
        </label>
      </div>
      <div className="form-pair">
        <label className="field">
          <span>Ajuste de precio (CLP)</span>
          <input
            name="priceAdjustment"
            type="number"
            min="-1000000"
            max="1000000"
            required
            defaultValue={variant?.priceAdjustment ?? 0}
          />
        </label>
        <label className="field">
          <span>Stock de variante</span>
          <input
            name="stock"
            type="number"
            min="0"
            max="100000"
            required
            defaultValue={variant?.stock ?? 0}
          />
        </label>
      </div>
      <label className="checkbox">
        <input
          name="active"
          type="checkbox"
          defaultChecked={variant?.active ?? true}
        />{" "}
        Disponible para comprar
      </label>
      <Feedback state={state} />
      <button type="submit" className="button outline" disabled={pending}>
        {pending ? "Guardando…" : "Guardar variante"}
      </button>
    </form>
  );
}

export function ReturnRequestForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(requestMyReturn, empty);
  return (
    <form action={action} className="form-stack panel">
      <input type="hidden" name="orderId" value={orderId} />
      <h2>Solicitar devolución</h2>
      <p className="muted">
        Disponible durante 30 días desde la compra de prueba, una vez entregada.
      </p>
      <label className="field">
        <span>Motivo</span>
        <textarea
          name="reason"
          required
          minLength={10}
          maxLength={500}
          rows={3}
        />
      </label>
      <Feedback state={state} />
      <button type="submit" className="button outline" disabled={pending}>
        {pending ? "Enviando…" : "Enviar solicitud"}
      </button>
    </form>
  );
}

export function ReturnDecisionForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(decideReturn, empty);
  return (
    <form action={action} className="form-stack compact-action">
      <input type="hidden" name="requestId" value={requestId} />
      <label className="field">
        <span>Nota administrativa</span>
        <input name="adminNote" maxLength={500} />
      </label>
      <label className="field">
        <span>Decisión</span>
        <select name="decision" defaultValue="APPROVED">
          <option value="APPROVED">Aprobar y reponer inventario</option>
          <option value="REJECTED">Rechazar</option>
        </select>
      </label>
      <Feedback state={state} />
      <button type="submit" className="plain" disabled={pending}>
        {pending ? "Resolviendo…" : "Resolver solicitud"}
      </button>
    </form>
  );
}
