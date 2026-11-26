using BodegaNet.Servicios;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace BodegaNet.Pages.Productos;

public sealed class IndexModel(ConsultasInventario consultas) : PageModel
{
    public List<FilaProducto> Filas { get; private set; } = [];

    public async Task OnGetAsync(CancellationToken ct) => Filas = await consultas.ProductosAsync(ct);
}
