using BodegaNet.Datos;
using BodegaNet.Dominio;
using BodegaNet.Servicios;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace BodegaNet.Api;

public sealed record CredencialesApi(string Correo, string Clave);

public sealed record SesionApi(string Nombre, string Correo, string Rol);

public sealed record ProductoNuevoApi(string Sku, string Nombre, string Unidad, int StockMinimo);

public sealed record ProductoApi(int Id, string Sku, string Nombre, string Unidad, int StockMinimo, bool Activo, int StockTotal, decimal Valor);

public sealed record BodegaApi(int Id, string Codigo, string Nombre, string Comuna);

public sealed record MovimientoApi(
    int Id, DateTime Fecha, string Tipo, int ProductoId, int BodegaId, int Cantidad,
    decimal CostoUnitario, int SaldoCantidad, decimal SaldoCostoPromedio, decimal SaldoValor,
    string? Referencia, string Usuario, Guid? TransferenciaId)
{
    public static MovimientoApi Desde(Movimiento m) => new(
        m.Id, m.Fecha, m.Tipo.ToString(), m.ProductoId, m.BodegaId, m.Cantidad, m.CostoUnitario,
        m.SaldoCantidad, m.SaldoCostoPromedio, m.SaldoValor, m.Referencia, m.Usuario, m.TransferenciaId);
}

public sealed record TransferenciaApi(MovimientoApi Salida, MovimientoApi Entrada);

/// <summary>API REST. Usa la misma cookie de sesión que la interfaz.</summary>
public static class ApiInventario
{
    public static void MapearApi(this WebApplication app)
    {
        var api = app.MapGroup("/api").WithTags("Inventario");

        api.MapPost("/sesion", IniciarSesion).AllowAnonymous().WithTags("Sesión")
            .WithSummary("Inicia sesión y deja la cookie de autenticación.");
        api.MapDelete("/sesion", async (HttpContext http) =>
        {
            await http.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return TypedResults.NoContent();
        }).WithTags("Sesión").WithSummary("Cierra la sesión.");

        api.MapGet("/resumen", (ConsultasInventario c, CancellationToken ct) => c.ResumenAsync(ct))
            .WithSummary("Valor del inventario, valor por bodega, alertas y últimos movimientos.");

        api.MapGet("/productos", async (ConsultasInventario c, CancellationToken ct) =>
                (await c.ProductosAsync(ct))
                .Select(p => new ProductoApi(p.Id, p.Sku, p.Nombre, p.Unidad, p.StockMinimo, p.Activo, p.StockTotal, p.Valor)))
            .WithSummary("Productos con su stock total y valor.");

        api.MapPost("/productos", CrearProducto)
            .RequireAuthorization(Politicas.Administrar)
            .WithSummary("Crea un producto (solo Administrador).");

        api.MapGet("/bodegas", async (BodegaDbContext db, CancellationToken ct) =>
                await db.Bodegas.AsNoTracking().OrderBy(b => b.Codigo)
                    .Select(b => new BodegaApi(b.Id, b.Codigo, b.Nombre, b.Comuna)).ToListAsync(ct))
            .WithSummary("Bodegas registradas.");

        api.MapGet("/existencias", (int? bodegaId, ConsultasInventario c, CancellationToken ct) => c.ExistenciasAsync(bodegaId, ct))
            .WithSummary("Saldo y costo promedio por producto y bodega.");

        api.MapGet("/alertas", (ConsultasInventario c, CancellationToken ct) => c.AlertasAsync(ct))
            .WithSummary("Productos con stock total bajo el mínimo.");

        api.MapGet("/kardex", (int productoId, int bodegaId, ConsultasInventario c, CancellationToken ct) =>
                c.KardexAsync(productoId, bodegaId, ct))
            .WithSummary("Kardex de un producto en una bodega, con costo promedio ponderado.");

        api.MapGet("/kardex.csv", KardexCsv)
            .WithSummary("Kardex en CSV (separado por punto y coma).");

        var movimientos = api.MapGroup("/movimientos").RequireAuthorization(Politicas.Mover);
        movimientos.MapPost("/entrada", (SolicitudEntrada s, ServicioInventario inv, HttpContext http, CancellationToken ct) =>
                Ejecutar(async () => MovimientoApi.Desde(await inv.RegistrarEntradaAsync(s, http.User.Nombre(), null, ct))))
            .WithSummary("Entrada con costo unitario: recalcula el costo promedio.");
        movimientos.MapPost("/salida", (SolicitudSalida s, ServicioInventario inv, HttpContext http, CancellationToken ct) =>
                Ejecutar(async () => MovimientoApi.Desde(await inv.RegistrarSalidaAsync(s, http.User.Nombre(), null, ct))))
            .WithSummary("Salida valorizada al costo promedio vigente. Nunca deja stock negativo.");
        movimientos.MapPost("/ajuste", (SolicitudAjuste s, ServicioInventario inv, HttpContext http, CancellationToken ct) =>
                Ejecutar(async () => MovimientoApi.Desde(await inv.RegistrarAjusteAsync(s, http.User.Nombre(), null, ct))))
            .WithSummary("Ajuste por conteo físico (cantidad positiva o negativa, con motivo).");
        movimientos.MapPost("/transferencia", (SolicitudTransferencia s, ServicioInventario inv, HttpContext http, CancellationToken ct) =>
                Ejecutar(async () =>
                {
                    var (salida, entrada) = await inv.RegistrarTransferenciaAsync(s, http.User.Nombre(), null, ct);
                    return new TransferenciaApi(MovimientoApi.Desde(salida), MovimientoApi.Desde(entrada));
                }))
            .WithSummary("Transferencia atómica entre bodegas.");
    }

    private static async Task<Results<Ok<SesionApi>, ProblemHttpResult>> IniciarSesion(
        CredencialesApi credenciales, ServicioUsuarios usuarios, HttpContext http, CancellationToken ct)
    {
        var usuario = await usuarios.ValidarAsync(credenciales.Correo ?? "", credenciales.Clave ?? "", ct);
        if (usuario is null)
        {
            return TypedResults.Problem("Correo o clave incorrectos.", statusCode: StatusCodes.Status401Unauthorized);
        }

        await ServicioUsuarios.IniciarSesionAsync(http, usuario);
        return TypedResults.Ok(new SesionApi(usuario.Nombre, usuario.Correo, usuario.Rol));
    }

    private static async Task<Results<Created<ProductoApi>, ValidationProblem, ProblemHttpResult>> CrearProducto(
        ProductoNuevoApi nuevo, BodegaDbContext db, CancellationToken ct)
    {
        var errores = ValidacionProducto.Validar(nuevo.Sku, nuevo.Nombre, nuevo.Unidad, nuevo.StockMinimo);
        if (errores.Count > 0)
        {
            return TypedResults.ValidationProblem(errores);
        }

        var sku = ValidacionProducto.NormalizarSku(nuevo.Sku);
        if (await db.Productos.AnyAsync(p => p.Sku == sku, ct))
        {
            return TypedResults.Problem($"Ya existe un producto con SKU {sku}.", statusCode: StatusCodes.Status409Conflict);
        }

        var producto = new Producto { Sku = sku, Nombre = nuevo.Nombre.Trim(), Unidad = nuevo.Unidad.Trim(), StockMinimo = nuevo.StockMinimo };
        db.Productos.Add(producto);
        await db.SaveChangesAsync(ct);
        return TypedResults.Created($"/api/productos/{producto.Id}",
            new ProductoApi(producto.Id, producto.Sku, producto.Nombre, producto.Unidad, producto.StockMinimo, true, 0, 0));
    }

    private static async Task<IResult> KardexCsv(int productoId, int bodegaId, BodegaDbContext db, ConsultasInventario c, CancellationToken ct)
    {
        var producto = await db.Productos.FindAsync([productoId], ct);
        var bodega = await db.Bodegas.FindAsync([bodegaId], ct);
        if (producto is null || bodega is null)
        {
            return TypedResults.Problem("Producto o bodega no encontrados.", statusCode: StatusCodes.Status404NotFound);
        }

        var filas = await c.KardexAsync(productoId, bodegaId, ct);
        return TypedResults.File(ExportadorCsv.Kardex(producto, bodega, filas), "text/csv; charset=utf-8",
            $"kardex-{producto.Sku}-{bodega.Codigo}.csv");
    }

    /// <summary>Traduce los errores de negocio a respuestas HTTP con mensaje en español.</summary>
    private static async Task<IResult> Ejecutar<T>(Func<Task<T>> accion)
    {
        try
        {
            return TypedResults.Ok(await accion());
        }
        catch (NoEncontradoException ex)
        {
            return TypedResults.Problem(ex.Message, statusCode: StatusCodes.Status404NotFound);
        }
        catch (StockInsuficienteException ex)
        {
            return TypedResults.Problem(ex.Message, statusCode: StatusCodes.Status409Conflict, title: "Stock insuficiente");
        }
        catch (ConflictoConcurrenciaException ex)
        {
            return TypedResults.Problem(ex.Message, statusCode: StatusCodes.Status409Conflict, title: "Conflicto de concurrencia");
        }
        catch (ReglaInventarioException ex)
        {
            return TypedResults.Problem(ex.Message, statusCode: StatusCodes.Status400BadRequest);
        }
    }
}

public static class Politicas
{
    public const string Mover = "Mover";
    public const string Administrar = "Administrar";
}

public static class ValidacionProducto
{
    public static string NormalizarSku(string? sku) => (sku ?? "").Trim().ToUpperInvariant();

    public static Dictionary<string, string[]> Validar(string? sku, string? nombre, string? unidad, int stockMinimo)
    {
        var errores = new Dictionary<string, string[]>();
        var s = NormalizarSku(sku);
        if (s.Length is < 3 or > 32 || !s.All(c => char.IsAsciiLetterOrDigit(c) || c == '-'))
        {
            errores["Sku"] = ["El SKU debe tener entre 3 y 32 caracteres: letras, números o guiones."];
        }

        if (string.IsNullOrWhiteSpace(nombre) || nombre.Trim().Length > 120)
        {
            errores["Nombre"] = ["El nombre es obligatorio y admite hasta 120 caracteres."];
        }

        if (string.IsNullOrWhiteSpace(unidad) || unidad.Trim().Length > 16)
        {
            errores["Unidad"] = ["La unidad es obligatoria (por ejemplo: un, caja, kg)."];
        }

        if (stockMinimo is < 0 or > ServicioInventario.CantidadMaxima)
        {
            errores["StockMinimo"] = ["El stock mínimo debe estar entre 0 y 1.000.000."];
        }

        return errores;
    }
}
