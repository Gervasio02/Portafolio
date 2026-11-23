import type { Metadata } from "next";
import Link from "next/link";
import { Status } from "@prisma/client";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { money, nextStatus } from "@/lib/commerce";
import { statusNames } from "@/lib/validation";
import { ProductForm } from "@/components/forms";
import { SalesChart } from "@/components/sales-chart";
import { archiveProduct, progressOrder } from "@/app/actions";

export const metadata: Metadata = {
  title: "Administración",
  robots: { index: false },
};

const zone = "America/Santiago";
const dateKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: zone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayTitle = new Intl.DateTimeFormat("es-CL", {
  timeZone: zone,
  weekday: "short",
});

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const [, { estado }] = await Promise.all([requireAdmin(), searchParams]);
  const selected = Object.values(Status).find((status) => status === estado);
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 86400000);
  const [products, orders, stats, recentSales, byStatus, lowStock] =
    await Promise.all([
      db.product.findMany({
        orderBy: [{ active: "desc" }, { name: "asc" }],
        take: 100,
      }),
      db.order.findMany({
        where: { status: selected },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { name: true } } },
      }),
      db.order.aggregate({ _sum: { total: true }, _count: true, where: { status: { not: "CANCELLED" } } }),
      db.order.findMany({
        where: { createdAt: { gte: since }, status: { not: "CANCELLED" } },
        select: { createdAt: true, total: true },
      }),
      db.order.groupBy({ by: ["status"], _count: true }),
      db.product.count({ where: { active: true, stock: { lte: 3 } } }),
    ]);
  const counts = new Map(
    byStatus.map(({ status, _count }) => [status, _count]),
  );
  const orderCount = byStatus.reduce((sum, row) => sum + row._count, 0);
  const sales = new Map<string, number>();
  for (const order of recentSales) {
    const key = dateKey.format(order.createdAt);
    sales.set(key, (sales.get(key) ?? 0) + order.total);
  }
  const series = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getTime() - (6 - index) * 86400000);
    return {
      day: dayTitle.format(date),
      sales: sales.get(dateKey.format(date)) ?? 0,
    };
  });
  return (
    <section className="wrap workpage">
      <p className="eyebrow">Gestión de tienda</p>
      <h1>Administración</h1>
      <nav className="category-links" aria-label="Secciones de administración">
        <Link href="#pedidos">Revisar pedidos</Link>
        <Link href="#inventario">Gestionar inventario</Link>
        <Link href="#ventas">Ver ventas</Link>
      </nav>
      <div className="admin-overview">
        <div className="panel stat">
          <span>Ventas de prueba</span>
          <strong>{money(stats._sum.total ?? 0)}</strong>
        </div>
        <div className="panel stat">
          <span>Pedidos</span>
          <strong>{orderCount}</strong>
        </div>
        <div className="panel stat">
          <span>Por despachar</span>
          <strong>{counts.get(Status.PAID) ?? 0}</strong>
        </div>
        <div className="panel stat">
          <span>Productos con 3 unidades o menos</span>
          <strong>{lowStock}</strong>
        </div>
      </div>
      <section className="panel admin-section" id="ventas">
        <h2>Ventas · últimos 7 días</h2>
        <SalesChart data={series} />
      </section>
      <section className="panel admin-section" id="inventario">
        <h2>Inventario</h2>
        <details>
          <summary>Crear producto</summary>
          <ProductForm />
        </details>
        <div className="admin-list">
          {products.map((product) => (
            <details key={product.id}>
              <summary>
                {product.name} · {product.stock} uds. ·{" "}
                {product.active ? "Visible" : "Archivado"}
              </summary>
              <ProductForm product={product} />
              {product.active && (
                <form action={archiveProduct}>
                  <input type="hidden" name="id" value={product.id} />
                  <button className="plain">Archivar producto</button>
                </form>
              )}
            </details>
          ))}
        </div>
      </section>
      <section className="panel admin-section" id="pedidos">
        <h2>Pedidos recientes</h2>
        <nav aria-label="Filtrar pedidos por estado" className="category-links">
          <Link
            href="/admin#pedidos"
            aria-current={!selected ? "page" : undefined}
          >
            Todos ({orderCount})
          </Link>
          {Object.values(Status).map((status) => (
            <Link
              key={status}
              href={`/admin?estado=${status}#pedidos`}
              aria-current={selected === status ? "page" : undefined}
            >
              {statusNames[status]} ({counts.get(status) ?? 0})
            </Link>
          ))}
        </nav>
        {orders.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const status = nextStatus(order.status);
                  return (
                    <tr key={order.id}>
                      <td>{order.id.slice(-8).toUpperCase()}</td>
                      <td>{order.user.name}</td>
                      <td>{money(order.total)}</td>
                      <td>{statusNames[order.status]}</td>
                      <td>
                        {status && (
                          <form action={progressOrder}>
                            <input type="hidden" name="id" value={order.id} />
                            <input
                              type="hidden"
                              name="expected"
                              value={order.status}
                            />
                            <button className="plain">
                              Marcar como {statusNames[status].toLowerCase()}
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">
            {selected
              ? "No hay pedidos en este estado."
              : "Aún no hay pedidos de demostración."}
          </p>
        )}
      </section>
    </section>
  );
}
