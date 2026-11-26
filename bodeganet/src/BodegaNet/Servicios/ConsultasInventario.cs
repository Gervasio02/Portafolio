using BodegaNet.Datos;
using BodegaNet.Dominio;
using Microsoft.EntityFrameworkCore;

namespace BodegaNet.Servicios;

public sealed record FilaExistencia(
    int ProductoId, string Sku, string Producto, string Unidad,
    int BodegaId, string Bodega, int Cantidad, decimal CostoPromedio, decimal Valor);

public sealed record FilaProducto(
    int Id, string Sku, string Nombre, string Unidad, int StockMinimo, bool Activo, int StockTotal, decimal Valor)
{
    public bool BajoMinimo => Activo && StockTotal < StockMinimo;
}

public sealed record FilaAlerta(int ProductoId, string Sku, string Producto, string Unidad, int StockTotal, int StockMinimo)
{
    public int Faltante => StockMinimo - StockTotal;
}

public sealed record FilaMovimiento(
    int Id, DateTime Fecha, TipoMovimiento Tipo, int ProductoId, string Sku, string Producto,
    int BodegaId, string Bodega, int Cantidad, decimal CostoUnitario, int SaldoCantidad,
    decimal SaldoCostoPromedio, decimal SaldoValor, string? Referencia, string Usuario)
{
    public int Entrada => Cantidad > 0 ? Cantidad : 0;

    public int Salida => Cantidad < 0 ? -Cantidad : 0;
}

public sealed record ValorBodega(int BodegaId, string Codigo, string Nombre, string Comuna, int Unidades, decimal Valor);

public sealed record Resumen(
    decimal ValorTotal, int Productos, int Unidades, IReadOnlyList<ValorBodega> Bodegas,
    IReadOnlyList<FilaAlerta> Alertas, IReadOnlyList<FilaMovimiento> Ultimos);

/// <summary>
/// Consultas de solo lectura. Los montos se suman en memoria porque SQLite
/// guarda los decimales como texto y no los agrega con exactitud.
/// </summary>
public sealed class ConsultasInventario(BodegaDbContext db)
{
    public async Task<Resumen> ResumenAsync(CancellationToken ct = default)
    {
        var existencias = await ExistenciasAsync(null, ct);
        var bodegas = await db.Bodegas.AsNoTracking().OrderBy(b => b.Codigo).ToListAsync(ct);
        var porBodega = bodegas
            .Select(b =>
            {
                var filas = existencias.Where(e => e.BodegaId == b.Id).ToList();
                return new ValorBodega(b.Id, b.Codigo, b.Nombre, b.Comuna, filas.Sum(f => f.Cantidad), filas.Sum(f => f.Valor));
            })
            .ToList();
        var productos = await db.Productos.CountAsync(p => p.Activo, ct);
        return new Resumen(
            existencias.Sum(e => e.Valor),
            productos,
            existencias.Sum(e => e.Cantidad),
            porBodega,
            await AlertasAsync(ct),
            await MovimientosAsync(null, null, null, 8, ct));
    }

    public async Task<List<FilaExistencia>> ExistenciasAsync(int? bodegaId, CancellationToken ct = default)
    {
        var consulta = db.Existencias.AsNoTracking();
        if (bodegaId is not null)
        {
            consulta = consulta.Where(e => e.BodegaId == bodegaId);
        }

        var filas = await consulta
            .Select(e => new
            {
                e.ProductoId,
                e.Producto!.Sku,
                Producto = e.Producto.Nombre,
                e.Producto.Unidad,
                e.BodegaId,
                Bodega = e.Bodega!.Nombre,
                e.Cantidad,
                e.CostoPromedio,
            })
            .ToListAsync(ct);

        return filas
            .Select(f => new FilaExistencia(
                f.ProductoId, f.Sku, f.Producto, f.Unidad, f.BodegaId, f.Bodega,
                f.Cantidad, f.CostoPromedio, Math.Round(f.Cantidad * f.CostoPromedio, 2)))
            .OrderBy(f => f.Sku, StringComparer.Ordinal)
            .ThenBy(f => f.Bodega, StringComparer.Ordinal)
            .ToList();
    }

    public async Task<List<FilaProducto>> ProductosAsync(CancellationToken ct = default)
    {
        var productos = await db.Productos.AsNoTracking().OrderBy(p => p.Sku).ToListAsync(ct);
        var existencias = await ExistenciasAsync(null, ct);
        return productos
            .Select(p =>
            {
                var filas = existencias.Where(e => e.ProductoId == p.Id).ToList();
                return new FilaProducto(p.Id, p.Sku, p.Nombre, p.Unidad, p.StockMinimo, p.Activo,
                    filas.Sum(f => f.Cantidad), filas.Sum(f => f.Valor));
            })
            .ToList();
    }

    /// <summary>Productos activos cuyo stock total (todas las bodegas) está bajo el mínimo.</summary>
    public async Task<List<FilaAlerta>> AlertasAsync(CancellationToken ct = default)
    {
        var totales = await db.Existencias.AsNoTracking()
            .GroupBy(e => e.ProductoId)
            .Select(g => new { ProductoId = g.Key, Total = g.Sum(e => e.Cantidad) })
            .ToDictionaryAsync(x => x.ProductoId, x => x.Total, ct);
        var productos = await db.Productos.AsNoTracking().Where(p => p.Activo).ToListAsync(ct);
        return productos
            .Select(p => new FilaAlerta(p.Id, p.Sku, p.Nombre, p.Unidad, totales.GetValueOrDefault(p.Id), p.StockMinimo))
            .Where(a => a.StockTotal < a.StockMinimo)
            .OrderByDescending(a => a.Faltante)
            .ThenBy(a => a.Sku, StringComparer.Ordinal)
            .ToList();
    }

    public async Task<List<FilaMovimiento>> MovimientosAsync(
        int? productoId, int? bodegaId, TipoMovimiento? tipo, int limite, CancellationToken ct = default)
    {
        var consulta = db.Movimientos.AsNoTracking();
        if (productoId is not null)
        {
            consulta = consulta.Where(m => m.ProductoId == productoId);
        }

        if (bodegaId is not null)
        {
            consulta = consulta.Where(m => m.BodegaId == bodegaId);
        }

        if (tipo is not null)
        {
            consulta = consulta.Where(m => m.Tipo == tipo);
        }

        var filas = await Proyectar(consulta.OrderByDescending(m => m.Id).Take(limite)).ToListAsync(ct);
        return filas;
    }

    /// <summary>Kardex de un producto en una bodega, en orden cronológico.</summary>
    public Task<List<FilaMovimiento>> KardexAsync(int productoId, int bodegaId, CancellationToken ct = default) =>
        Proyectar(db.Movimientos.AsNoTracking()
                .Where(m => m.ProductoId == productoId && m.BodegaId == bodegaId)
                .OrderBy(m => m.Id))
            .ToListAsync(ct);

    private static IQueryable<FilaMovimiento> Proyectar(IQueryable<Movimiento> consulta) =>
        consulta.Select(m => new FilaMovimiento(
            m.Id, m.Fecha, m.Tipo, m.ProductoId, m.Producto!.Sku, m.Producto.Nombre,
            m.BodegaId, m.Bodega!.Nombre, m.Cantidad, m.CostoUnitario, m.SaldoCantidad,
            m.SaldoCostoPromedio, m.SaldoValor, m.Referencia, m.Usuario));
}
