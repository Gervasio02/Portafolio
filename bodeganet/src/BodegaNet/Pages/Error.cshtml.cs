using System.Diagnostics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace BodegaNet.Pages;

[AllowAnonymous]
[IgnoreAntiforgeryToken]
[ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
public sealed class ErrorModel : PageModel
{
    public string? IdSolicitud { get; private set; }

    public void OnGet() => IdSolicitud = Activity.Current?.Id ?? HttpContext.TraceIdentifier;

    public void OnPost() => OnGet();
}
