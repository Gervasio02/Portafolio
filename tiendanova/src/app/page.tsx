import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  ClipboardList,
  LampDesk,
  ShoppingBag,
  Store,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { loadCatalog } from "@/lib/catalog";
import { categories, categoryNames } from "@/lib/validation";
import { money } from "@/lib/commerce";

export const dynamic = "force-dynamic";

function catalogLink(
  filters: {
    q: string;
    category?: string;
    min?: number;
    max?: number;
    sort: string;
  },
  page: number,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page }))
    if (value !== undefined && value !== "") params.set(key, String(value));
  return `/?${params}#catalogo`;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { products, filters, count, page, totalPages } = await loadCatalog(
    await searchParams,
  );
  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">
              <span aria-hidden>●</span> Tienda de escritorio · Chile
            </p>
            <h1>
              Lo que necesitas
              <br />
              para tu escritorio.
            </h1>
            <p className="hero-sub">
              Elige una lámpara, un teclado o un accesorio para tu espacio de
              trabajo. Prueba la compra y sigue tu pedido sin cargos ni envíos
              reales.
            </p>
            <div className="hero-actions">
              <Link href="#catalogo" className="button lime">
                Explorar catálogo <ArrowRight size={18} />
              </Link>
              <Link href="#como-funciona" className="demo-hero-link">
                Cómo probar la tienda
              </Link>
            </div>
          </div>
          <div className="hero-photo">
            <Image
              src="/products/workspace.jpg"
              alt="Escritorio de madera con accesorios para trabajar"
              fill
              sizes="(min-width: 780px) 48vw, 100vw"
              preload
            />
          </div>
        </div>
      </section>
      <section
        className="wrap catalog"
        id="catalogo"
        aria-labelledby="catalog-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Colección Nova</p>
            <h2 id="catalog-title">Catálogo</h2>
          </div>
          <span className="muted">
            {count} {count === 1 ? "producto" : "productos"}
          </span>
        </div>
        <nav className="category-links" aria-label="Accesos por categoría">
          <Link
            href={catalogLink({ ...filters, category: undefined }, 1)}
            aria-current={!filters.category ? "page" : undefined}
          >
            Todas
          </Link>
          {categories.map((category) => (
            <Link
              key={category}
              href={catalogLink({ ...filters, category }, 1)}
              aria-current={filters.category === category ? "page" : undefined}
            >
              {categoryNames[category]}
            </Link>
          ))}
        </nav>
        <form className="filters" action="/#catalogo">
          <label className="searchbox">
            <Search size={18} aria-hidden />
            <input
              name="q"
              type="search"
              aria-label="Buscar productos"
              placeholder="Buscar en el catálogo"
              defaultValue={filters.q}
            />
          </label>
          <label className="field">
            <span>Categoría</span>
            <select name="category" defaultValue={filters.category ?? ""}>
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {categoryNames[category]}
                </option>
              ))}
            </select>
          </label>
          <label className="field price-filter">
            <span>Desde</span>
            <input
              name="min"
              type="number"
              min="0"
              placeholder="$0"
              defaultValue={filters.min}
            />
          </label>
          <label className="field price-filter">
            <span>Hasta</span>
            <input
              name="max"
              type="number"
              min="0"
              placeholder="Sin tope"
              defaultValue={filters.max}
            />
          </label>
          <label className="field">
            <span>Orden</span>
            <select name="sort" defaultValue={filters.sort}>
              <option value="recent">Más recientes</option>
              <option value="price-asc">Menor precio</option>
              <option value="price-desc">Mayor precio</option>
              <option value="name">Nombre</option>
            </select>
          </label>
          <button className="button dark" type="submit">
            <SlidersHorizontal size={17} aria-hidden /> Filtrar
          </button>
        </form>
        {products.length ? (
          <div className="product-grid">
            {products.map((product) => (
              <article className="product" key={product.id}>
                <Link
                  href={`/catalogo/${product.slug}`}
                  className="product-link"
                >
                  <div className="product-photo">
                    <Image
                      src={product.images[0] ?? "/products/workspace.jpg"}
                      alt={product.name}
                      fill
                      sizes="(min-width: 1000px) 31vw, (min-width: 600px) 48vw, 100vw"
                    />
                  </div>
                  <div className="product-copy">
                    <div>
                      <p className="product-category">
                        {categoryNames[product.category]}
                      </p>
                      <h3>{product.name}</h3>
                    </div>
                    <ArrowUpRight
                      className="product-arrow"
                      size={22}
                      aria-hidden
                    />
                  </div>
                </Link>
                <div className="product-meta">
                  <strong>{money(product.price)}</strong>
                  <span
                    className={
                      product.stock ? "availability" : "availability out"
                    }
                  >
                    {product.stock ? "Disponible" : "Agotado"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">
            <h3>No encontramos productos</h3>
            <p>Prueba con otro nombre o ajusta el filtro de precio.</p>
            <Link href="/#catalogo" className="button outline">
              <X size={17} /> Limpiar filtros
            </Link>
          </div>
        )}
        {totalPages > 1 && (
          <nav className="pagination" aria-label="Paginación del catálogo">
            {page > 1 && (
              <Link href={catalogLink(filters, page - 1)}>Anterior</Link>
            )}
            <span>
              Página {page} de {totalPages}
            </span>
            {page < totalPages && (
              <Link href={catalogLink(filters, page + 1)}>
                Siguiente <ArrowRight size={16} />
              </Link>
            )}
          </nav>
        )}
      </section>
      <section
        className="guide"
        id="como-funciona"
        aria-labelledby="guide-title"
      >
        <div className="wrap">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Guía de demostración</p>
              <h2 id="guide-title">De la vitrina al despacho</h2>
            </div>
          </div>
          <div className="guide-grid">
            <article>
              <LampDesk aria-hidden />
              <h3>Elige un producto</h3>
              <p>
                Busca una lámpara, revisa sus fotos y comprueba cuántas unidades
                quedan.
              </p>
              <Link href="#catalogo" className="text-link">
                Ir al catálogo <ArrowRight size={16} />
              </Link>
            </article>
            <article>
              <ShoppingBag aria-hidden />
              <h3>Simula una compra</h3>
              <p>
                El carrito guarda tu selección. Crea una cuenta con datos
                ficticios, agrega una dirección de prueba y elige si apruebas o
                rechazas el pago.
              </p>
              <Link href="/carrito" className="text-link">
                Abrir mi carrito <ArrowRight size={16} />
              </Link>
            </article>
            <article>
              <ClipboardList aria-hidden />
              <h3>Sigue tu pedido</h3>
              <p>
                El pedido aprobado descuenta el stock y queda en tu historial.
                Allí podrás ver cuándo el administrador lo marca como enviado o
                entregado.
              </p>
              <Link href="/cuenta" className="text-link">
                Ver mis pedidos <ArrowRight size={16} />
              </Link>
            </article>
            <article>
              <Store aria-hidden />
              <h3>Gestiona la tienda</h3>
              <p>
                Desde una cuenta administradora puedes ajustar inventario y
                actualizar entregas. El cliente seguirá viendo su pedido, aunque
                archives el producto.
              </p>
              <Link href="/admin" className="text-link">
                Acceso de administración <Boxes size={16} />
              </Link>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
