using BodegaNet.Servicios;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace BodegaNet.Pages;

public sealed class AlertasModel(ConsultasInventario consultas) : PageModel
{
    public List<FilaAlerta> Alertas { get; private set; } = [];

    public async Task OnGetAsync(CancellationToken ct) => Alertas = await consultas.AlertasAsync(ct);
}
