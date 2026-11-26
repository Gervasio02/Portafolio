using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace BodegaNet.Pages;

[AllowAnonymous]
public sealed class AccesoDenegadoModel : PageModel
{
    public void OnGet()
    {
    }
}
