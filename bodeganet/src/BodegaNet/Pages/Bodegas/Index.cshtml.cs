using BodegaNet.Servicios;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace BodegaNet.Pages.Bodegas;

public sealed class IndexModel(ConsultasInventario consultas) : PageModel
{
    [BindProperty(SupportsGet = true)]
    public int? BodegaId { get; set; }

    public IReadOnlyList<ValorBodega> Bodegas { get; private set; } = [];

    public ValorBodega? Seleccionada { get; private set; }

    public List<FilaExistencia> Existencias { get; private set; } = [];

    public async Task OnGetAsync(CancellationToken ct)
    {
        Bodegas = (await consultas.ResumenAsync(ct)).Bodegas;
        Seleccionada = Bodegas.FirstOrDefault(b => b.BodegaId == BodegaId) ?? Bodegas.FirstOrDefault();
        if (Seleccionada is not null)
        {
            Existencias = await consultas.ExistenciasAsync(Seleccionada.BodegaId, ct);
        }
    }
}
