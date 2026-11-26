using BodegaNet.Datos;
using BodegaNet.Dominio;
using BodegaNet.Servicios;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace BodegaNet.Pruebas;

/// <summary>
/// Cada prueba usa su propia base: un archivo SQLite temporal o, si existe
/// <c>BODEGANET_PRUEBAS_POSTGRES</c>, una base PostgreSQL con nombre único.
/// </summary>
public static class BaseDatosPrueba
{
    public static string? Postgres => Environment.GetEnvironmentVariable("BODEGANET_PRUEBAS_POSTGRES");

    public static Dictionary<string, string?> NuevaConfiguracion()
    {
        if (!string.IsNullOrWhiteSpace(Postgres))
        {
            var cadena = new NpgsqlConnectionStringBuilder(Postgres)
            {
                Database = "bodeganet_" + Guid.NewGuid().ToString("N")[..12],
            };
            return new() { ["ConnectionStrings:Default"] = cadena.ConnectionString };
        }

        var ruta = Path.Combine(Path.GetTempPath(), "bodeganet-pruebas", Guid.NewGuid().ToString("N") + ".db");
        return new() { ["SQLITE_RUTA"] = ruta };
    }
}

/// <summary>Contenedor de servicios real (sin servidor web) para probar el dominio.</summary>
public sealed class EntornoServicios : IAsyncDisposable
{
    private readonly ServiceProvider proveedor;

    private EntornoServicios(ServiceProvider proveedor) => this.proveedor = proveedor;

    public static async Task<EntornoServicios> CrearAsync()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(BaseDatosPrueba.NuevaConfiguracion()).Build();
        var servicios = new ServiceCollection();
        servicios.AddSingleton<IConfiguration>(config);
        servicios.AddLogging();
        servicios.AddSingleton(TimeProvider.System);
        servicios.AgregarBaseDatos();
        servicios.AddScoped<ServicioInventario>();
        servicios.AddScoped<ConsultasInventario>();
        var entorno = new EntornoServicios(servicios.BuildServiceProvider());
        await using var alcance = entorno.Alcance();
        await alcance.ServiceProvider.GetRequiredService<BodegaDbContext>().Database.MigrateAsync();
        return entorno;
    }

    public AsyncServiceScope Alcance() => proveedor.CreateAsyncScope();

    public async Task<T> ConAsync<T>(Func<IServiceProvider, Task<T>> accion)
    {
        await using var alcance = Alcance();
        return await accion(alcance.ServiceProvider);
    }

    public Task<Movimiento> EntradaAsync(int producto, int bodega, int cantidad, decimal costo) =>
        ConAsync(sp => sp.GetRequiredService<ServicioInventario>()
            .RegistrarEntradaAsync(new(producto, bodega, cantidad, costo, "Factura de prueba"), "pruebas"));

    public Task<Movimiento> SalidaAsync(int producto, int bodega, int cantidad) =>
        ConAsync(sp => sp.GetRequiredService<ServicioInventario>()
            .RegistrarSalidaAsync(new(producto, bodega, cantidad, "Guía de prueba"), "pruebas"));

    public Task<Existencia?> ExistenciaAsync(int producto, int bodega) =>
        ConAsync(sp => sp.GetRequiredService<BodegaDbContext>().Existencias.AsNoTracking()
            .SingleOrDefaultAsync(e => e.ProductoId == producto && e.BodegaId == bodega));

    public Task<int> ContarMovimientosAsync() =>
        ConAsync(sp => sp.GetRequiredService<BodegaDbContext>().Movimientos.CountAsync());

    /// <summary>Crea dos bodegas y un producto; devuelve sus identificadores.</summary>
    public Task<(int Producto, int Central, int Norte)> CatalogoAsync() =>
        ConAsync(async sp =>
        {
            var db = sp.GetRequiredService<BodegaDbContext>();
            var central = new Bodega { Codigo = "CEN", Nombre = "Central", Comuna = "Rancagua" };
            var norte = new Bodega { Codigo = "NOR", Nombre = "Norte", Comuna = "Quilicura" };
            var producto = new Producto { Sku = "PRB-001", Nombre = "Caja de prueba", Unidad = "un", StockMinimo = 5 };
            db.AddRange(central, norte, producto);
            await db.SaveChangesAsync();
            return (producto.Id, central.Id, norte.Id);
        });

    public async ValueTask DisposeAsync()
    {
        await using (var alcance = Alcance())
        {
            await alcance.ServiceProvider.GetRequiredService<BodegaDbContext>().Database.EnsureDeletedAsync();
        }

        await proveedor.DisposeAsync();
    }
}

/// <summary>La app completa en memoria, con su propia base de datos.</summary>
public sealed class FabricaBodegaNet : WebApplicationFactory<Program>
{
    private readonly Dictionary<string, string?> configuracion = BaseDatosPrueba.NuevaConfiguracion();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        foreach (var (clave, valor) in configuracion)
        {
            builder.UseSetting(clave, valor);
        }
    }
}
