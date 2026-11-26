using System.ComponentModel.DataAnnotations;
using BodegaNet.Api;
using BodegaNet.Datos;
using BodegaNet.Dominio;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace BodegaNet.Pages.Productos;

[Authorize(Policy = Politicas.Administrar)]
public sealed class EditarModel(BodegaDbContext db) : PageModel
{
    [BindProperty]
    public DatosProducto Datos { get; set; } = new();

    public int? Id { get; private set; }

    public async Task<IActionResult> OnGetAsync(int? id, CancellationToken ct)
    {
        Id = id;
        if (id is null)
        {
            return Page();
        }

        var producto = await db.Productos.AsNoTracking().SingleOrDefaultAsync(p => p.Id == id, ct);
        if (producto is null)
        {
            return NotFound();
        }

        Datos = new DatosProducto
        {
            Sku = producto.Sku,
            Nombre = producto.Nombre,
            Unidad = producto.Unidad,
            StockMinimo = producto.StockMinimo,
            Activo = producto.Activo,
        };
        return Page();
    }

    public async Task<IActionResult> OnPostAsync(int? id, CancellationToken ct)
    {
        Id = id;
        foreach (var (campo, mensajes) in ValidacionProducto.Validar(Datos.Sku, Datos.Nombre, Datos.Unidad, Datos.StockMinimo ?? 0))
        {
            // Si el campo ya tiene un error (por ejemplo, vacío), no se repite el mensaje.
            if (ModelState[$"Datos.{campo}"]?.Errors.Count > 0)
            {
                continue;
            }

            foreach (var mensaje in mensajes)
            {
                ModelState.AddModelError($"Datos.{campo}", mensaje);
            }
        }

        if (!ModelState.IsValid)
        {
            return Page();
        }

        var sku = ValidacionProducto.NormalizarSku(Datos.Sku);
        if (await db.Productos.AnyAsync(p => p.Sku == sku && p.Id != id, ct))
        {
            ModelState.AddModelError("Datos.Sku", $"Ya existe un producto con SKU {sku}.");
            return Page();
        }

        Producto producto;
        if (id is null)
        {
            producto = new Producto { Sku = sku, Nombre = "", Unidad = "" };
            db.Productos.Add(producto);
        }
        else
        {
            var existente = await db.Productos.SingleOrDefaultAsync(p => p.Id == id, ct);
            if (existente is null)
            {
                return NotFound();
            }

            producto = existente;
        }

        producto.Sku = sku;
        producto.Nombre = Datos.Nombre!.Trim();
        producto.Unidad = Datos.Unidad!.Trim();
        producto.StockMinimo = Datos.StockMinimo ?? 0;
        producto.Activo = id is null || Datos.Activo;
        await db.SaveChangesAsync(ct);

        TempData["Aviso"] = id is null ? $"Producto {sku} creado." : $"Producto {sku} actualizado.";
        return RedirectToPage("/Productos/Index");
    }

    public sealed class DatosProducto
    {
        [Display(Name = "SKU")]
        [Required(ErrorMessage = "El SKU es obligatorio.")]
        public string? Sku { get; set; }

        [Required(ErrorMessage = "El nombre es obligatorio.")]
        public string? Nombre { get; set; }

        [Required(ErrorMessage = "La unidad es obligatoria.")]
        public string? Unidad { get; set; }

        [Display(Name = "Stock mínimo")]
        [Required(ErrorMessage = "Indica el stock mínimo (puede ser 0).")]
        public int? StockMinimo { get; set; }

        [Display(Name = "Activo")]
        public bool Activo { get; set; } = true;
    }
}
