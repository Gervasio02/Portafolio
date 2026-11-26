using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace BodegaNet.Datos;

public static class ConfiguracionBaseDatos
{
    /// <summary>
    /// Usa PostgreSQL si existe <c>DATABASE_URL</c> o <c>ConnectionStrings:Default</c>;
    /// si no, SQLite en un archivo local (la demo se reinicia con cada contenedor).
    /// </summary>
    public static IServiceCollection AgregarBaseDatos(this IServiceCollection services)
    {
        // La configuración se lee al resolver el contexto (no al registrarlo), así
        // las pruebas pueden cambiarla con WebApplicationFactory.
        services.AddDbContext<BodegaSqliteContext>((sp, o) =>
            o.UseSqlite($"Data Source={RutaSqlite(sp.GetRequiredService<IConfiguration>())};Default Timeout=30"));
        services.AddDbContext<BodegaPostgresContext>((sp, o) =>
            o.UseNpgsql(CadenaPostgres(sp.GetRequiredService<IConfiguration>())));
        services.AddScoped<BodegaDbContext>(sp =>
            CadenaPostgres(sp.GetRequiredService<IConfiguration>()) is null
                ? sp.GetRequiredService<BodegaSqliteContext>()
                : sp.GetRequiredService<BodegaPostgresContext>());
        return services;
    }

    public static string RutaSqlite(IConfiguration config)
    {
        var ruta = config["SQLITE_RUTA"];
        if (string.IsNullOrWhiteSpace(ruta))
        {
            ruta = Path.Combine(AppContext.BaseDirectory, "datos", "bodeganet.db");
        }

        var carpeta = Path.GetDirectoryName(Path.GetFullPath(ruta));
        if (!string.IsNullOrEmpty(carpeta))
        {
            Directory.CreateDirectory(carpeta);
        }

        return ruta;
    }

    public static string? CadenaPostgres(IConfiguration config)
    {
        var url = config["DATABASE_URL"];
        if (!string.IsNullOrWhiteSpace(url))
        {
            return DesdeUrl(url.Trim());
        }

        var cadena = config.GetConnectionString("Default");
        return string.IsNullOrWhiteSpace(cadena) ? null : cadena;
    }

    /// <summary>
    /// Acepta tanto <c>postgres://usuario:clave@host:5432/base?sslmode=require</c>
    /// como una cadena de conexión de Npgsql.
    /// </summary>
    public static string DesdeUrl(string url)
    {
        if (!url.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            && !url.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            return url;
        }

        var uri = new Uri(url);
        var credenciales = uri.UserInfo.Split(':', 2);
        var cadena = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort || uri.Port <= 0 ? 5432 : uri.Port,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
            Username = Uri.UnescapeDataString(credenciales[0]),
        };
        if (credenciales.Length > 1)
        {
            cadena.Password = Uri.UnescapeDataString(credenciales[1]);
        }

        foreach (var parte in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var par = parte.Split('=', 2);
            if (par.Length == 2 && par[0].Equals("sslmode", StringComparison.OrdinalIgnoreCase)
                && Enum.TryParse<SslMode>(par[1], ignoreCase: true, out var modo))
            {
                cadena.SslMode = modo;
            }
        }

        return cadena.ConnectionString;
    }
}
