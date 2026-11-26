using System.Text.Encodings.Web;
using System.Text.Json.Serialization;
using System.Text.Unicode;
using BodegaNet.Api;
using BodegaNet.Datos;
using BodegaNet.Dominio;
using BodegaNet.Servicios;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.WebEncoders;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AgregarBaseDatos();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<IPasswordHasher<Usuario>, PasswordHasher<Usuario>>();
builder.Services.AddScoped<ServicioInventario>();
builder.Services.AddScoped<ConsultasInventario>();
builder.Services.AddScoped<ServicioUsuarios>();

builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(o =>
    {
        o.LoginPath = "/Login";
        o.LogoutPath = "/Salir";
        o.AccessDeniedPath = "/AccesoDenegado";
        o.Cookie.Name = "bodeganet.sesion";
        o.Cookie.HttpOnly = true;
        o.Cookie.SameSite = SameSiteMode.Lax;
        o.ExpireTimeSpan = TimeSpan.FromHours(8);
        o.SlidingExpiration = true;
        // La API responde 401/403 en vez de redirigir al formulario de login.
        o.Events.OnRedirectToLogin = ctx => ResponderOApi(ctx.HttpContext, ctx.RedirectUri, StatusCodes.Status401Unauthorized);
        o.Events.OnRedirectToAccessDenied = ctx => ResponderOApi(ctx.HttpContext, ctx.RedirectUri, StatusCodes.Status403Forbidden);
    });

builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
    .AddPolicy(Politicas.Mover, p => p.RequireRole(Roles.Administrador, Roles.Bodeguero))
    .AddPolicy(Politicas.Administrar, p => p.RequireRole(Roles.Administrador));

builder.Services.AddRazorPages().AddMvcOptions(o =>
{
    var m = o.ModelBindingMessageProvider;
    m.SetValueMustNotBeNullAccessor(_ => "Este campo es obligatorio.");
    m.SetMissingBindRequiredValueAccessor(_ => "Este campo es obligatorio.");
    m.SetAttemptedValueIsInvalidAccessor((valor, _) => $"«{valor}» no es un valor válido.");
    m.SetNonPropertyAttemptedValueIsInvalidAccessor(valor => $"«{valor}» no es un valor válido.");
    m.SetUnknownValueIsInvalidAccessor(_ => "El valor no es válido.");
    m.SetNonPropertyUnknownValueIsInvalidAccessor(() => "El valor no es válido.");
    m.SetValueIsInvalidAccessor(valor => $"«{valor}» no es un valor válido.");
    m.SetValueMustBeANumberAccessor(_ => "Debe ser un número.");
    m.SetNonPropertyValueMustBeANumberAccessor(() => "Debe ser un número.");
    m.SetMissingKeyOrValueAccessor(() => "Este campo es obligatorio.");
    m.SetMissingRequestBodyRequiredValueAccessor(() => "Falta el cuerpo de la solicitud.");
});

builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddOpenApi();
// Acentos y eñes tal cual en el HTML, en vez de entidades numéricas.
builder.Services.Configure<WebEncoderOptions>(o => o.TextEncoderSettings = new TextEncoderSettings(UnicodeRanges.All));

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
}

app.Use(async (ctx, next) =>
{
    var h = ctx.Response.Headers;
    h["X-Content-Type-Options"] = "nosniff";
    h["Referrer-Policy"] = "strict-origin-when-cross-origin";
    h["X-Frame-Options"] = "DENY";
    h["Content-Security-Policy"] =
        "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; " +
        "form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'";
    await next();
});

app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

// El portal consulta esta ruta desde otro origen para despertar la app.
app.MapGet("/health", (HttpContext http) =>
{
    http.Response.Headers["Cross-Origin-Resource-Policy"] = "cross-origin";
    http.Response.Headers.CacheControl = "no-store";
    return TypedResults.Ok(new { estado = "ok", servicio = "bodeganet" });
}).AllowAnonymous().ExcludeFromDescription();

app.MapOpenApi().AllowAnonymous();
app.MapearApi();
app.MapRazorPages();

await SemillaDemo.PrepararAsync(app.Services);
await app.RunAsync();

static Task ResponderOApi(HttpContext http, string destino, int estado)
{
    if (http.Request.Path.StartsWithSegments("/api"))
    {
        http.Response.StatusCode = estado;
    }
    else
    {
        http.Response.Redirect(destino);
    }

    return Task.CompletedTask;
}

public partial class Program;
