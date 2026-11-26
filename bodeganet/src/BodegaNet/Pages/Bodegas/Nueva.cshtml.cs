using System.ComponentModel.DataAnnotations;
using BodegaNet.Api;
using BodegaNet.Datos;
using BodegaNet.Dominio;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace BodegaNet.Pages.Bodegas;

[Authorize(Policy = Politicas.Administrar)]
public sealed class NuevaModel(BodegaDbContext db) : PageModel
{
    [BindProperty]
    public DatosBodega Datos { get; set; } = new();

    public void OnGet()
    {
    }

    public async Task<IActionResult> OnPostAsync(CancellationToken ct)
    {
        if (!ModelState.IsValid)
        {
            return Page();
        }

        var codigo = Datos.Codigo!.Trim().ToUpperInvariant();
        if (await db.Bodegas.AnyAsync(b => b.Codigo == codigo, ct))
        {
            ModelState.AddModelError("Datos.Codigo", $"Ya existe una bodega con código {codigo}.");
            return Page();
        }

        var bodega = new Bodega { Codigo = codigo, Nombre = Datos.Nombre!.Trim(), Comuna = Datos.Comuna!.Trim() };
        db.Bodegas.Add(bodega);
        await db.SaveChangesAsync(ct);
        TempData["Aviso"] = $"Bodega {codigo} creada.";
        return RedirectToPage("/Bodegas/Index", new { bodegaId = bodega.Id });
    }

    public sealed class DatosBodega
    {
        [Display(Name = "Código")]
        [Required(ErrorMessage = "El código es obligatorio.")]
        [RegularExpression("^[A-Za-z0-9-]{2,12}$", ErrorMessage = "Usa de 2 a 12 letras, números o guiones.")]
        public string? Codigo { get; set; }

        [Required(ErrorMessage = "El nombre es obligatorio.")]
        [StringLength(80, ErrorMessage = "El nombre admite hasta 80 caracteres.")]
        public string? Nombre { get; set; }

        [Required(ErrorMessage = "La comuna es obligatoria.")]
        [StringLength(60, ErrorMessage = "La comuna admite hasta 60 caracteres.")]
        public string? Comuna { get; set; }
    }
}
