using BodegaNet.Datos;
using BodegaNet.Dominio;
using BodegaNet.Servicios;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace BodegaNet.Pages.Movimientos;

public sealed class IndexModel(BodegaDbContext db, ConsultasInventario consultas) : FormularioMovimiento(db)
{
    public const int Limite = 100;

    [BindProperty(SupportsGet = true)]
    public int? ProductoId { get; set; }

    [BindProperty(SupportsGet = true)]
    public int? BodegaId { get; set; }

    [BindProperty(SupportsGet = true)]
    public TipoMovimiento? Tipo { get; set; }

    public List<FilaMovimiento> Filas { get; private set; } = [];

    public List<SelectListItem> OpcionesTipo { get; } =
        Enum.GetValues<TipoMovimiento>().Select(t => new SelectListItem(Formato.Tipo(t), t.ToString())).ToList();

    public async Task OnGetAsync(CancellationToken ct)
    {
        await CargarOpcionesAsync(null, ct);
        Filas = await consultas.MovimientosAsync(ProductoId, BodegaId, Tipo, Limite, ct);
    }
}
