using BodegaNet.Datos;
using BodegaNet.Dominio;
using Microsoft.EntityFrameworkCore;

namespace BodegaNet.Servicios;

public sealed record SolicitudEntrada(int ProductoId, int BodegaId, int Cantidad, decimal CostoUnitario, string? Referencia);

public sealed record SolicitudSalida(int ProductoId, int BodegaId, int Cantidad, string? Referencia);

/// <summary>Ajuste por conteo físico: la cantidad puede ser positiva o negativa.</summary>
public sealed record SolicitudAjuste(int ProductoId, int BodegaId, int Cantidad, string? Referencia);

public sealed record SolicitudTransferencia(int ProductoId, int BodegaOrigenId, int BodegaDestinoId, int Cantidad, string? Referencia);

/// <summary>
/// Registra movimientos de inventario. Cada operación corre en una
/// transacción; si otra operación cambió el mismo saldo entre la lectura y la
/// escritura (token <see cref="Existencia.Version"/>), se descarta todo y se
/// reintenta con los datos frescos.
/// </summary>
public sealed class ServicioInventario(BodegaDbContext db, TimeProvider reloj, ILogger<ServicioInventario> log)
{
    public const int CantidadMaxima = 1_000_000;
    public const decimal CostoMaximo = 1_000_000_000m;
    private const int MaxIntentos = 8;

    public Task<Movimiento> RegistrarEntradaAsync(SolicitudEntrada s, string usuario, DateTime? fecha = null, CancellationToken ct = default)
    {
        ValidarCantidad(s.Cantidad);
        if (s.CostoUnitario <= 0 || s.CostoUnitario > CostoMaximo)
        {
            throw new ReglaInventarioException("El costo unitario debe ser mayor que cero.");
        }

        return EnTransaccionAsync(async () =>
        {
            var (producto, bodega) = await CargarAsync(s.ProductoId, s.BodegaId, ct);
            var existencia = await ObtenerOCrearAsync(producto.Id, bodega.Id, ct);
            var movimiento = AplicarEntrada(existencia, s.Cantidad, s.CostoUnitario);
            return Registrar(movimiento, TipoMovimiento.Entrada, existencia, s.Referencia, usuario, fecha, null);
        }, ct);
    }

    public Task<Movimiento> RegistrarSalidaAsync(SolicitudSalida s, string usuario, DateTime? fecha = null, CancellationToken ct = default)
    {
        ValidarCantidad(s.Cantidad);
        return EnTransaccionAsync(async () =>
        {
            var (producto, bodega) = await CargarAsync(s.ProductoId, s.BodegaId, ct);
            var existencia = await BuscarAsync(producto.Id, bodega.Id, ct);
            var movimiento = AplicarSalida(existencia, producto, bodega, s.Cantidad);
            return Registrar(movimiento, TipoMovimiento.Salida, existencia!, s.Referencia, usuario, fecha, null);
        }, ct);
    }

    public Task<Movimiento> RegistrarAjusteAsync(SolicitudAjuste s, string usuario, DateTime? fecha = null, CancellationToken ct = default)
    {
        if (s.Cantidad == 0 || s.Cantidad > CantidadMaxima || s.Cantidad < -CantidadMaxima)
        {
            throw new ReglaInventarioException($"El ajuste debe ser distinto de cero y no superar 1.000.000 unidades.");
        }

        if (string.IsNullOrWhiteSpace(s.Referencia))
        {
            throw new ReglaInventarioException("Indica el motivo del ajuste.");
        }

        return EnTransaccionAsync(async () =>
        {
            var (producto, bodega) = await CargarAsync(s.ProductoId, s.BodegaId, ct);
            Movimiento movimiento;
            Existencia existencia;
            if (s.Cantidad > 0)
            {
                existencia = await ObtenerOCrearAsync(producto.Id, bodega.Id, ct);
                // Un sobrante de conteo se valoriza al promedio vigente: no cambia el costo.
                movimiento = AplicarEntrada(existencia, s.Cantidad, existencia.CostoPromedio);
            }
            else
            {
                var encontrada = await BuscarAsync(producto.Id, bodega.Id, ct);
                movimiento = AplicarSalida(encontrada, producto, bodega, -s.Cantidad);
                existencia = encontrada!;
            }

            return Registrar(movimiento, TipoMovimiento.Ajuste, existencia, s.Referencia, usuario, fecha, null);
        }, ct);
    }

    /// <summary>Salida del origen y entrada al destino en la misma transacción.</summary>
    public Task<(Movimiento Salida, Movimiento Entrada)> RegistrarTransferenciaAsync(
        SolicitudTransferencia s, string usuario, DateTime? fecha = null, CancellationToken ct = default)
    {
        ValidarCantidad(s.Cantidad);
        if (s.BodegaOrigenId == s.BodegaDestinoId)
        {
            throw new ReglaInventarioException("La bodega de origen y la de destino deben ser distintas.");
        }

        return EnTransaccionAsync(async () =>
        {
            var (producto, origen) = await CargarAsync(s.ProductoId, s.BodegaOrigenId, ct);
            var destino = await db.Bodegas.FindAsync([s.BodegaDestinoId], ct)
                ?? throw new NoEncontradoException("La bodega de destino no existe.");

            var id = Guid.NewGuid();
            var exOrigen = await BuscarAsync(producto.Id, origen.Id, ct);
            var salida = AplicarSalida(exOrigen, producto, origen, s.Cantidad);
            var costo = salida.CostoUnitario;

            var exDestino = await ObtenerOCrearAsync(producto.Id, destino.Id, ct);
            var entrada = AplicarEntrada(exDestino, s.Cantidad, costo);

            var referencia = string.IsNullOrWhiteSpace(s.Referencia) ? $"{origen.Codigo} → {destino.Codigo}" : s.Referencia;
            return (
                Registrar(salida, TipoMovimiento.TransferenciaSalida, exOrigen!, referencia, usuario, fecha, id),
                Registrar(entrada, TipoMovimiento.TransferenciaEntrada, exDestino, referencia, usuario, fecha, id));
        }, ct);
    }

    /// <summary>Costo promedio ponderado: (saldo × promedio + entrada × costo) / nuevo saldo.</summary>
    public static decimal NuevoPromedio(int saldo, decimal promedio, int cantidad, decimal costo)
    {
        var total = saldo + cantidad;
        if (total <= 0)
        {
            return promedio;
        }

        return Math.Round(((saldo * promedio) + (cantidad * costo)) / total, 4, MidpointRounding.AwayFromZero);
    }

    private static Movimiento AplicarEntrada(Existencia e, int cantidad, decimal costo)
    {
        e.CostoPromedio = NuevoPromedio(e.Cantidad, e.CostoPromedio, cantidad, costo);
        e.Cantidad += cantidad;
        e.Version++;
        return new Movimiento { Usuario = "", Cantidad = cantidad, CostoUnitario = costo };
    }

    private static Movimiento AplicarSalida(Existencia? e, Producto producto, Bodega bodega, int cantidad)
    {
        var disponible = e?.Cantidad ?? 0;
        if (e is null || disponible < cantidad)
        {
            throw new StockInsuficienteException(producto.Nombre, bodega.Nombre, disponible, cantidad);
        }

        // La salida se valoriza al promedio vigente y no lo modifica.
        e.Cantidad -= cantidad;
        e.Version++;
        return new Movimiento { Usuario = "", Cantidad = -cantidad, CostoUnitario = e.CostoPromedio };
    }

    private Movimiento Registrar(Movimiento m, TipoMovimiento tipo, Existencia e, string? referencia, string usuario, DateTime? fecha, Guid? transferencia)
    {
        m.Tipo = tipo;
        m.ProductoId = e.ProductoId;
        m.BodegaId = e.BodegaId;
        m.Fecha = fecha ?? reloj.GetUtcNow().UtcDateTime;
        m.SaldoCantidad = e.Cantidad;
        m.SaldoCostoPromedio = e.CostoPromedio;
        m.SaldoValor = e.Valor;
        m.Referencia = Recortar(referencia, 120);
        m.Usuario = usuario;
        m.TransferenciaId = transferencia;
        db.Movimientos.Add(m);
        return m;
    }

    private static string? Recortar(string? texto, int largo)
    {
        if (string.IsNullOrWhiteSpace(texto))
        {
            return null;
        }

        var limpio = texto.Trim();
        return limpio.Length <= largo ? limpio : limpio[..largo];
    }

    private static void ValidarCantidad(int cantidad)
    {
        if (cantidad <= 0 || cantidad > CantidadMaxima)
        {
            throw new ReglaInventarioException("La cantidad debe estar entre 1 y 1.000.000.");
        }
    }

    private async Task<(Producto, Bodega)> CargarAsync(int productoId, int bodegaId, CancellationToken ct)
    {
        var producto = await db.Productos.FindAsync([productoId], ct);
        if (producto is null || !producto.Activo)
        {
            throw new NoEncontradoException("El producto no existe o está inactivo.");
        }

        var bodega = await db.Bodegas.FindAsync([bodegaId], ct)
            ?? throw new NoEncontradoException("La bodega no existe.");
        return (producto, bodega);
    }

    private Task<Existencia?> BuscarAsync(int productoId, int bodegaId, CancellationToken ct) =>
        db.Existencias.SingleOrDefaultAsync(x => x.ProductoId == productoId && x.BodegaId == bodegaId, ct);

    private async Task<Existencia> ObtenerOCrearAsync(int productoId, int bodegaId, CancellationToken ct)
    {
        var existencia = await BuscarAsync(productoId, bodegaId, ct);
        if (existencia is null)
        {
            existencia = new Existencia { ProductoId = productoId, BodegaId = bodegaId };
            db.Existencias.Add(existencia);
        }

        return existencia;
    }

    private async Task<T> EnTransaccionAsync<T>(Func<Task<T>> trabajo, CancellationToken ct)
    {
        for (var intento = 1; ; intento++)
        {
            await using var transaccion = await db.Database.BeginTransactionAsync(ct);
            try
            {
                var resultado = await trabajo();
                await db.SaveChangesAsync(ct);
                await transaccion.CommitAsync(ct);
                return resultado;
            }
            catch (DbUpdateException ex)
            {
                await transaccion.RollbackAsync(CancellationToken.None);
                db.ChangeTracker.Clear();
                if (intento >= MaxIntentos)
                {
                    log.LogWarning(ex, "Se agotaron los reintentos por concurrencia.");
                    throw new ConflictoConcurrenciaException();
                }

                // Otra operación ganó la carrera (token de versión o índice único): se relee y se reintenta.
                log.LogInformation("Conflicto de concurrencia, intento {Intento}.", intento);
                await Task.Delay(Random.Shared.Next(5, 25) * intento, ct);
            }
            catch
            {
                db.ChangeTracker.Clear();
                throw;
            }
        }
    }
}
