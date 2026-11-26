using System.ComponentModel.DataAnnotations;
using BodegaNet.Api;
using BodegaNet.Datos;
using BodegaNet.Servicios;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BodegaNet.Pages.Movimientos;

[Authorize(Policy = Politicas.Mover)]
public sealed class EntradaModel(BodegaDbContext db, ServicioInventario inventario) : FormularioMovimiento(db)
{
    [BindProperty]
    public DatosEntrada Datos { get; set; } = new();

    public async Task OnGetAsync(int? productoId, int? bodegaId, CancellationToken ct)
    {
        Datos.ProductoId = productoId;
        Datos.BodegaId = bodegaId;
        await CargarOpcionesAsync(productoId, ct);
    }

    public async Task<IActionResult> OnPostAsync(CancellationToken ct)
    {
        if (!ModelState.IsValid)
        {
            await CargarOpcionesAsync(Datos.ProductoId, ct);
            return Page();
        }

        var productoId = Datos.ProductoId!.Value;
        var bodegaId = Datos.BodegaId!.Value;
        return await RegistrarAsync(productoId, bodegaId, "Entrada registrada. Puedes ver las unidades disponibles en el historial.", () =>
            inventario.RegistrarEntradaAsync(
                new SolicitudEntrada(productoId, bodegaId, Datos.Cantidad!.Value, Datos.CostoUnitario!.Value, Datos.Referencia),
                User.Nombre(), null, ct), ct);
    }

    public sealed class DatosEntrada
    {
        [Display(Name = "Producto")]
        [Required(ErrorMessage = "Elige un producto.")]
        public int? ProductoId { get; set; }

        [Display(Name = "Bodega")]
        [Required(ErrorMessage = "Elige una bodega.")]
        public int? BodegaId { get; set; }

        [Required(ErrorMessage = "Indica la cantidad.")]
        [Range(1, ServicioInventario.CantidadMaxima, ErrorMessage = "La cantidad debe estar entre 1 y 1.000.000.")]
        public int? Cantidad { get; set; }

        [Display(Name = "Costo unitario")]
        [Required(ErrorMessage = "Indica el costo unitario.")]
        [Range(typeof(decimal), "0.0001", "1000000000", ErrorMessage = "El costo unitario debe ser mayor que cero.",
            ParseLimitsInInvariantCulture = true, ConvertValueInInvariantCulture = true)]
        public decimal? CostoUnitario { get; set; }

        [Display(Name = "Documento o referencia")]
        [StringLength(120, ErrorMessage = "La referencia admite hasta 120 caracteres.")]
        public string? Referencia { get; set; }
    }
}
