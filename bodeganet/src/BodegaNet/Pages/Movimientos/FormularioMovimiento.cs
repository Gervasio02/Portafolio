using BodegaNet.Datos;
using BodegaNet.Dominio;
using BodegaNet.Servicios;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace BodegaNet.Pages.Movimientos;

/// <summary>Base de los formularios de movimiento: listas de selección y manejo de errores.</summary>
public abstract class FormularioMovimiento : PageModel
{
    protected FormularioMovimiento(BodegaDbContext db) => Db = db;

    protected BodegaDbContext Db { get; }

    public List<SelectListItem> OpcionesProductos { get; private set; } = [];

    public List<SelectListItem> OpcionesBodegas { get; private set; } = [];

    /// <summary>Saldos actuales para mostrar junto al formulario.</summary>
    public List<FilaExistencia> Saldos { get; private set; } = [];

    public async Task<IActionResult> OnGetDisponibilidadAsync(int productoId, int bodegaId, CancellationToken ct)
    {
        var unidad = await Db.Productos.AsNoTracking()
            .Where(p => p.Id == productoId && p.Activo)
            .Select(p => p.Unidad)
            .SingleOrDefaultAsync(ct);
        if (unidad is null || !await Db.Bodegas.AnyAsync(b => b.Id == bodegaId, ct))
        {
            return NotFound();
        }

        var cantidad = await Db.Existencias.AsNoTracking()
            .Where(e => e.ProductoId == productoId && e.BodegaId == bodegaId)
            .Select(e => e.Cantidad)
            .SingleOrDefaultAsync(ct);
        Response.Headers.CacheControl = "no-store";
        return new JsonResult(new { cantidad, unidad });
    }

    protected async Task CargarOpcionesAsync(int? productoId, CancellationToken ct)
    {
        OpcionesProductos = await Db.Productos.AsNoTracking()
            .Where(p => p.Activo)
            .OrderBy(p => p.Sku)
            .Select(p => new SelectListItem(p.Sku + " · " + p.Nombre, p.Id.ToString()))
            .ToListAsync(ct);
        OpcionesBodegas = await Db.Bodegas.AsNoTracking()
            .OrderBy(b => b.Codigo)
            .Select(b => new SelectListItem(b.Codigo + " · " + b.Nombre, b.Id.ToString()))
            .ToListAsync(ct);
        if (productoId is not null)
        {
            Saldos = (await new ConsultasInventario(Db).ExistenciasAsync(null, ct))
                .Where(e => e.ProductoId == productoId)
                .ToList();
        }
    }

    /// <summary>
    /// Ejecuta el registro; si una regla de negocio lo impide, vuelve a mostrar
    /// el formulario con el mensaje. Si funciona, lleva al kardex.
    /// </summary>
    protected async Task<IActionResult> RegistrarAsync(
        int productoId, int bodegaId, string aviso, Func<Task> registrar, CancellationToken ct)
    {
        try
        {
            await registrar();
        }
        catch (ReglaInventarioException ex)
        {
            ModelState.AddModelError(string.Empty, ex.Message);
            await CargarOpcionesAsync(productoId, ct);
            return Page();
        }

        TempData["Aviso"] = aviso;
        return RedirectToPage("/Kardex", new { productoId, bodegaId });
    }
}
