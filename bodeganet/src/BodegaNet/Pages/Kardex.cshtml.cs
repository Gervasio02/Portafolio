using BodegaNet.Datos;
using BodegaNet.Dominio;
using BodegaNet.Servicios;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace BodegaNet.Pages;

public sealed class KardexModel(BodegaDbContext db, ConsultasInventario consultas) : Movimientos.FormularioMovimiento(db)
{
    [BindProperty(SupportsGet = true)]
    public int? ProductoId { get; set; }

    [BindProperty(SupportsGet = true)]
    public int? BodegaId { get; set; }

    public Producto? Producto { get; private set; }

    public Bodega? Bodega { get; private set; }

    public List<FilaMovimiento> Filas { get; private set; } = [];

    public int TotalEntradas => Filas.Sum(f => f.Entrada);

    public int TotalSalidas => Filas.Sum(f => f.Salida);

    public async Task<IActionResult> OnGetAsync(CancellationToken ct)
    {
        await CargarOpcionesAsync(ProductoId, ct);
        await CargarAsync(ct);
        return Page();
    }

    public async Task<IActionResult> OnGetCsvAsync(CancellationToken ct)
    {
        await CargarAsync(ct);
        if (Producto is null || Bodega is null)
        {
            return NotFound();
        }

        return File(ExportadorCsv.Kardex(Producto, Bodega, Filas), "text/csv; charset=utf-8",
            $"kardex-{Producto.Sku}-{Bodega.Codigo}.csv");
    }

    private async Task CargarAsync(CancellationToken ct)
    {
        if (ProductoId is null)
        {
            return;
        }

        Producto = await Db.Productos.AsNoTracking().SingleOrDefaultAsync(p => p.Id == ProductoId, ct);
        if (Producto is null)
        {
            return;
        }

        // Si no se eligió bodega, se usa la primera donde el producto tiene saldo.
        BodegaId ??= await Db.Existencias.AsNoTracking()
            .Where(e => e.ProductoId == ProductoId)
            .OrderBy(e => e.BodegaId)
            .Select(e => (int?)e.BodegaId)
            .FirstOrDefaultAsync(ct);
        if (BodegaId is null)
        {
            return;
        }

        Bodega = await Db.Bodegas.AsNoTracking().SingleOrDefaultAsync(b => b.Id == BodegaId, ct);
        if (Bodega is not null)
        {
            Filas = await consultas.KardexAsync(Producto.Id, Bodega.Id, ct);
        }
    }
}
