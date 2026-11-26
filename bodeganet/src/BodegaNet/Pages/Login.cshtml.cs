using System.ComponentModel.DataAnnotations;
using BodegaNet.Servicios;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace BodegaNet.Pages;

[AllowAnonymous]
public sealed class LoginModel(ServicioUsuarios usuarios) : PageModel
{
    [BindProperty]
    public DatosLogin Datos { get; set; } = new();

    [BindProperty(SupportsGet = true)]
    public string? ReturnUrl { get; set; }

    public IActionResult OnGet() =>
        User.Identity?.IsAuthenticated == true ? Redirect(Destino()) : Page();

    public async Task<IActionResult> OnPostAsync(CancellationToken ct)
    {
        if (!ModelState.IsValid)
        {
            return Page();
        }

        var usuario = await usuarios.ValidarAsync(Datos.Correo!, Datos.Clave!, ct);
        if (usuario is null)
        {
            ModelState.AddModelError(string.Empty, "Correo o clave incorrectos.");
            return Page();
        }

        await ServicioUsuarios.IniciarSesionAsync(HttpContext, usuario);
        return Redirect(Destino());
    }

    public async Task<IActionResult> OnPostInvitadoAsync(CancellationToken ct)
    {
        ModelState.Clear();
        var invitado = await usuarios.InvitadoAsync(ct);
        if (invitado is null)
        {
            ModelState.AddModelError(string.Empty, "El acceso de invitado no está disponible.");
            return Page();
        }

        await ServicioUsuarios.IniciarSesionAsync(HttpContext, invitado);
        return Redirect(Destino());
    }

    // Solo se vuelve a rutas locales, para no abrir una redirección a otro sitio.
    private string Destino() => !string.IsNullOrEmpty(ReturnUrl) && Url.IsLocalUrl(ReturnUrl) ? ReturnUrl : "/";

    public sealed class DatosLogin
    {
        [Required(ErrorMessage = "Escribe tu correo.")]
        [EmailAddress(ErrorMessage = "El correo no tiene un formato válido.")]
        [StringLength(120, ErrorMessage = "El correo es demasiado largo.")]
        public string? Correo { get; set; }

        [Required(ErrorMessage = "Escribe tu clave.")]
        [StringLength(100, ErrorMessage = "La clave es demasiado larga.")]
        public string? Clave { get; set; }
    }
}
