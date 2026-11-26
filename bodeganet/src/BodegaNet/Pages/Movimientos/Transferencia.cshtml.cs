using System.ComponentModel.DataAnnotations;
using BodegaNet.Api;
using BodegaNet.Datos;
using BodegaNet.Servicios;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BodegaNet.Pages.Movimientos;

[Authorize(Policy = Politicas.Mover)]
public sealed class TransferenciaModel(BodegaDbContext db, ServicioInventario inventario) : FormularioMovimiento(db)
{
    [BindProperty]
    public DatosTransferencia Datos { get; set; } = new();

    public async Task OnGetAsync(int? productoId, int? bodegaId, CancellationToken ct)
    {
        Datos.ProductoId = productoId;
        Datos.OrigenId = bodegaId;
        await CargarOpcionesAsync(productoId, ct);
    }

    public async Task<IActionResult> OnPostAsync(CancellationToken ct)
    {
        if (Datos.OrigenId is not null && Datos.OrigenId == Datos.DestinoId)
        {
            ModelState.AddModelError("Datos.DestinoId", "El destino debe ser distinto del origen.");
        }

        if (!ModelState.IsValid)
        {
            await CargarOpcionesAsync(Datos.ProductoId, ct);
            return Page();
        }

        var productoId = Datos.ProductoId!.Value;
        var origenId = Datos.OrigenId!.Value;
        return await RegistrarAsync(productoId, origenId, "Transferencia registrada: salió del origen y entró al destino en una sola operación.", () =>
            inventario.RegistrarTransferenciaAsync(
                new SolicitudTransferencia(productoId, origenId, Datos.DestinoId!.Value, Datos.Cantidad!.Value, Datos.Referencia),
                User.Nombre(), null, ct), ct);
    }

    public sealed class DatosTransferencia
    {
        [Display(Name = "Producto")]
        [Required(ErrorMessage = "Elige un producto.")]
        public int? ProductoId { get; set; }

        [Display(Name = "Bodega de origen")]
        [Required(ErrorMessage = "Elige la bodega de origen.")]
        public int? OrigenId { get; set; }

        [Display(Name = "Bodega de destino")]
        [Required(ErrorMessage = "Elige la bodega de destino.")]
        public int? DestinoId { get; set; }

        [Required(ErrorMessage = "Indica la cantidad.")]
        [Range(1, ServicioInventario.CantidadMaxima, ErrorMessage = "La cantidad debe estar entre 1 y 1.000.000.")]
        public int? Cantidad { get; set; }

        [Display(Name = "Documento o referencia")]
        [StringLength(120, ErrorMessage = "La referencia admite hasta 120 caracteres.")]
        public string? Referencia { get; set; }
    }
}
