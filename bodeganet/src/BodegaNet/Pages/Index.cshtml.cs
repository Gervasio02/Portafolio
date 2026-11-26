using BodegaNet.Servicios;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace BodegaNet.Pages;

public sealed class IndexModel(ConsultasInventario consultas) : PageModel
{
    public Resumen Resumen { get; private set; } = null!;

    public async Task OnGetAsync(CancellationToken ct) => Resumen = await consultas.ResumenAsync(ct);
}
