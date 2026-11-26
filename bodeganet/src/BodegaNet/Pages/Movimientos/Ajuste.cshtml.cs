using System.ComponentModel.DataAnnotations;
using BodegaNet.Api;
using BodegaNet.Datos;
using BodegaNet.Servicios;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BodegaNet.Pages.Movimientos;

[Authorize(Policy = Politicas.Mover)]
public sealed class AjusteModel(BodegaDbContext db, ServicioInventario inventario) : FormularioMovimiento(db)
{
    [BindProperty]
    public DatosAjuste Datos { get; set; } = new();

    public async Task OnGetAsync(int? productoId, int? bodegaId, CancellationToken ct)
    {
        Datos.ProductoId = productoId;
        Datos.BodegaId = bodegaId;
        await CargarOpcionesAsync(productoId, ct);
    }

    public async Task<IActionResult> OnPostAsync(CancellationToken ct)
    {
        if (Datos.Cantidad == 0)
        {
            ModelState.AddModelError("Datos.Cantidad", "El ajuste debe ser distinto de cero.");
        }

        if (!ModelState.IsValid)
        {
            await CargarOpcionesAsync(Datos.ProductoId, ct);
            return Page();
        }

        var productoId = Datos.ProductoId!.Value;
        var bodegaId = Datos.BodegaId!.Value;
        return await RegistrarAsync(productoId, bodegaId, "Ajuste registrado.", () =>
            inventario.RegistrarAjusteAsync(
                new SolicitudAjuste(productoId, bodegaId, Datos.Cantidad!.Value, Datos.Motivo),
                User.Nombre(), null, ct), ct);
    }

    public sealed class DatosAjuste
    {
        [Display(Name = "Producto")]
        [Required(ErrorMessage = "Elige un producto.")]
        public int? ProductoId { get; set; }

        [Display(Name = "Bodega")]
        [Required(ErrorMessage = "Elige una bodega.")]
        public int? BodegaId { get; set; }

        [Display(Name = "Diferencia (+ sobrante, − faltante)")]
        [Required(ErrorMessage = "Indica la diferencia del conteo.")]
        [Range(-ServicioInventario.CantidadMaxima, ServicioInventario.CantidadMaxima, ErrorMessage = "El ajuste no puede superar 1.000.000 unidades.")]
        public int? Cantidad { get; set; }

        [Required(ErrorMessage = "Indica el motivo del ajuste.")]
        [StringLength(120, ErrorMessage = "El motivo admite hasta 120 caracteres.")]
        public string? Motivo { get; set; }
    }
}
