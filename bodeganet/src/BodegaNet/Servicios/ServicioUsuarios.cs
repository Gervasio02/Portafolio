using System.Security.Claims;
using BodegaNet.Datos;
using BodegaNet.Dominio;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace BodegaNet.Servicios;

public sealed class ServicioUsuarios(BodegaDbContext db, IPasswordHasher<Usuario> hasher)
{
    public const string CorreoInvitado = "invitado@bodeganet.test";

    public async Task<Usuario?> ValidarAsync(string correo, string clave, CancellationToken ct = default)
    {
        var normalizado = correo.Trim().ToLowerInvariant();
        var usuario = await db.Usuarios.SingleOrDefaultAsync(u => u.Correo == normalizado, ct);
        if (usuario is null || usuario.Correo == CorreoInvitado || string.IsNullOrEmpty(usuario.ClaveHash))
        {
            // Se calcula un hash igual para no revelar por tiempo si el correo existe.
            hasher.HashPassword(new Usuario { Correo = "", Nombre = "", Rol = "" }, clave);
            return null;
        }

        var resultado = hasher.VerifyHashedPassword(usuario, usuario.ClaveHash, clave);
        return resultado == PasswordVerificationResult.Failed ? null : usuario;
    }

    public Task<Usuario?> InvitadoAsync(CancellationToken ct = default) =>
        db.Usuarios.SingleOrDefaultAsync(u => u.Correo == CorreoInvitado, ct);

    public static Task IniciarSesionAsync(HttpContext http, Usuario usuario)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, usuario.Id.ToString(System.Globalization.CultureInfo.InvariantCulture)),
            new(ClaimTypes.Name, usuario.Nombre),
            new(ClaimTypes.Email, usuario.Correo),
            new(ClaimTypes.Role, usuario.Rol),
        };
        var identidad = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        return http.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identidad));
    }
}

public static class UsuarioActual
{
    public static string Nombre(this ClaimsPrincipal usuario) => usuario.Identity?.Name ?? "desconocido";

    public static string Rol(this ClaimsPrincipal usuario) => usuario.FindFirstValue(ClaimTypes.Role) ?? "";

    public static bool PuedeMover(this ClaimsPrincipal usuario) =>
        usuario.IsInRole(Roles.Administrador) || usuario.IsInRole(Roles.Bodeguero);

    public static bool EsAdministrador(this ClaimsPrincipal usuario) => usuario.IsInRole(Roles.Administrador);
}
