using BodegaNet.Datos;
using BodegaNet.Dominio;
using BodegaNet.Servicios;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace BodegaNet.Pruebas;

public sealed class ServicioInventarioPruebas
{
    [Theory]
    [InlineData(0, 0, 10, 1000, 1000)]
    [InlineData(10, 1000, 10, 1300, 1150)]
    [InlineData(15, 1150, 5, 1350, 1200)]
    [InlineData(3, 100, 1, 101, 100.25)]
    public void CostoPromedioPonderado(int saldo, double promedio, int cantidad, double costo, double esperado)
    {
        Assert.Equal((decimal)esperado, ServicioInventario.NuevoPromedio(saldo, (decimal)promedio, cantidad, (decimal)costo));
    }

    [Fact]
    public async Task EntradasRecalculanElPromedioYLasSalidasSeValorizanAlPromedioVigente()
    {
        await using var e = await EntornoServicios.CrearAsync();
        var (p, cen, _) = await e.CatalogoAsync();

        await e.EntradaAsync(p, cen, 10, 1000m);
        var segunda = await e.EntradaAsync(p, cen, 10, 1300m);
        Assert.Equal(1150m, segunda.SaldoCostoPromedio);
        Assert.Equal(23000m, segunda.SaldoValor);

        var salida = await e.SalidaAsync(p, cen, 5);
        Assert.Equal(-5, salida.Cantidad);
        Assert.Equal(1150m, salida.CostoUnitario);
        Assert.Equal(15, salida.SaldoCantidad);
        Assert.Equal(1150m, salida.SaldoCostoPromedio);
        Assert.Equal(17250m, salida.SaldoValor);

        // Una entrada posterior a otro costo vuelve a ponderar sobre el saldo restante.
        var tercera = await e.EntradaAsync(p, cen, 5, 1350m);
        Assert.Equal(1200m, tercera.SaldoCostoPromedio);
        Assert.Equal(20, tercera.SaldoCantidad);
    }

    [Fact]
    public async Task SalidaSinStockSuficienteSeRechazaSinCambiarNada()
    {
        await using var e = await EntornoServicios.CrearAsync();
        var (p, cen, nor) = await e.CatalogoAsync();
        await e.EntradaAsync(p, cen, 4, 500m);

        var error = await Assert.ThrowsAsync<StockInsuficienteException>(() => e.SalidaAsync(p, cen, 5));
        Assert.Equal(4, error.Disponible);
        Assert.Contains("Stock insuficiente", error.Message);
        await Assert.ThrowsAsync<StockInsuficienteException>(() => e.SalidaAsync(p, nor, 1));

        Assert.Equal(4, (await e.ExistenciaAsync(p, cen))!.Cantidad);
        Assert.Equal(1, await e.ContarMovimientosAsync());
    }

    [Fact]
    public async Task TransferenciaMueveStockYCostoEnUnaSolaOperacion()
    {
        await using var e = await EntornoServicios.CrearAsync();
        var (p, cen, nor) = await e.CatalogoAsync();
        await e.EntradaAsync(p, cen, 10, 1000m);
        await e.EntradaAsync(p, cen, 10, 1300m);

        var (salida, entrada) = await e.ConAsync(sp => sp.GetRequiredService<ServicioInventario>()
            .RegistrarTransferenciaAsync(new(p, cen, nor, 8, null), "pruebas"));

        Assert.Equal(TipoMovimiento.TransferenciaSalida, salida.Tipo);
        Assert.Equal(TipoMovimiento.TransferenciaEntrada, entrada.Tipo);
        Assert.NotNull(salida.TransferenciaId);
        Assert.Equal(salida.TransferenciaId, entrada.TransferenciaId);
        Assert.Equal(1150m, entrada.CostoUnitario);
        Assert.Equal(12, (await e.ExistenciaAsync(p, cen))!.Cantidad);
        var destino = (await e.ExistenciaAsync(p, nor))!;
        Assert.Equal(8, destino.Cantidad);
        Assert.Equal(1150m, destino.CostoPromedio);
    }

    [Fact]
    public async Task TransferenciaFallidaNoDejaRastroEnNingunaBodega()
    {
        await using var e = await EntornoServicios.CrearAsync();
        var (p, cen, nor) = await e.CatalogoAsync();
        await e.EntradaAsync(p, cen, 3, 1000m);

        await Assert.ThrowsAsync<StockInsuficienteException>(() => e.ConAsync(sp => sp.GetRequiredService<ServicioInventario>()
            .RegistrarTransferenciaAsync(new(p, cen, nor, 5, null), "pruebas")));
        await Assert.ThrowsAsync<ReglaInventarioException>(() => e.ConAsync(sp => sp.GetRequiredService<ServicioInventario>()
            .RegistrarTransferenciaAsync(new(p, cen, cen, 1, null), "pruebas")));

        Assert.Equal(3, (await e.ExistenciaAsync(p, cen))!.Cantidad);
        Assert.Null(await e.ExistenciaAsync(p, nor));
        Assert.Equal(1, await e.ContarMovimientosAsync());
    }

    [Fact]
    public async Task AjustesRespetanElPromedioYNoDejanStockNegativo()
    {
        await using var e = await EntornoServicios.CrearAsync();
        var (p, cen, _) = await e.CatalogoAsync();
        await e.EntradaAsync(p, cen, 10, 800m);

        Task<Movimiento> Ajustar(int cantidad, string? motivo) => e.ConAsync(sp => sp.GetRequiredService<ServicioInventario>()
            .RegistrarAjusteAsync(new(p, cen, cantidad, motivo), "pruebas"));

        var sobrante = await Ajustar(2, "Conteo: sobrante");
        Assert.Equal(12, sobrante.SaldoCantidad);
        Assert.Equal(800m, sobrante.SaldoCostoPromedio);

        await Assert.ThrowsAsync<StockInsuficienteException>(() => Ajustar(-13, "Conteo: faltante"));
        await Assert.ThrowsAsync<ReglaInventarioException>(() => Ajustar(-1, " "));
        await Assert.ThrowsAsync<ReglaInventarioException>(() => Ajustar(0, "Nada"));

        var faltante = await Ajustar(-12, "Conteo: faltante");
        Assert.Equal(0, faltante.SaldoCantidad);
    }

    [Fact]
    public async Task ValidaCantidadesYCostos()
    {
        await using var e = await EntornoServicios.CrearAsync();
        var (p, cen, _) = await e.CatalogoAsync();

        await Assert.ThrowsAsync<ReglaInventarioException>(() => e.EntradaAsync(p, cen, 0, 100m));
        await Assert.ThrowsAsync<ReglaInventarioException>(() => e.EntradaAsync(p, cen, 5, 0m));
        await Assert.ThrowsAsync<ReglaInventarioException>(() => e.SalidaAsync(p, cen, -1));
        await Assert.ThrowsAsync<NoEncontradoException>(() => e.EntradaAsync(9999, cen, 1, 100m));
        Assert.Equal(0, await e.ContarMovimientosAsync());
    }

    [Fact]
    public async Task ElTokenDeVersionDetectaDosEscriturasSobreElMismoSaldo()
    {
        await using var e = await EntornoServicios.CrearAsync();
        var (p, cen, _) = await e.CatalogoAsync();
        await e.EntradaAsync(p, cen, 10, 1000m);

        // Dos operaciones leen el mismo saldo (10) antes de que cualquiera escriba.
        await using var a = e.Alcance();
        await using var b = e.Alcance();
        var dbA = a.ServiceProvider.GetRequiredService<BodegaDbContext>();
        var dbB = b.ServiceProvider.GetRequiredService<BodegaDbContext>();
        var exA = await dbA.Existencias.SingleAsync(x => x.ProductoId == p && x.BodegaId == cen);
        var exB = await dbB.Existencias.SingleAsync(x => x.ProductoId == p && x.BodegaId == cen);

        exA.Cantidad -= 7;
        exA.Version++;
        await dbA.SaveChangesAsync();

        // La segunda escritura usaba un saldo viejo: la base la rechaza en vez de dejar -4.
        exB.Cantidad -= 7;
        exB.Version++;
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => dbB.SaveChangesAsync());

        Assert.Equal(3, (await e.ExistenciaAsync(p, cen))!.Cantidad);
    }

    [Fact]
    public async Task LaBaseRechazaUnSaldoNegativoAunqueSeSalteElServicio()
    {
        await using var e = await EntornoServicios.CrearAsync();
        var (p, cen, _) = await e.CatalogoAsync();
        await e.EntradaAsync(p, cen, 1, 1000m);

        await using var alcance = e.Alcance();
        var db = alcance.ServiceProvider.GetRequiredService<BodegaDbContext>();
        var existencia = await db.Existencias.SingleAsync(x => x.ProductoId == p);
        existencia.Cantidad = -1;
        await Assert.ThrowsAnyAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task SalidasSimultaneasNuncaDejanElStockNegativo()
    {
        await using var e = await EntornoServicios.CrearAsync();
        var (p, cen, _) = await e.CatalogoAsync();
        await e.EntradaAsync(p, cen, 10, 1000m);

        // Diez salidas de 3 unidades llegan a la vez sobre un saldo de 10: solo caben tres.
        var tareas = Enumerable.Range(0, 10).Select(async _ =>
        {
            try
            {
                await e.SalidaAsync(p, cen, 3);
                return true;
            }
            catch (StockInsuficienteException)
            {
                return false;
            }
        });
        var resultados = await Task.WhenAll(tareas);

        Assert.Equal(3, resultados.Count(r => r));
        var final = (await e.ExistenciaAsync(p, cen))!;
        Assert.Equal(1, final.Cantidad);

        var kardex = await e.ConAsync(sp => sp.GetRequiredService<ConsultasInventario>().KardexAsync(p, cen));
        Assert.Equal(4, kardex.Count);
        Assert.All(kardex, f => Assert.True(f.SaldoCantidad >= 0));
        Assert.Equal(new[] { 10, 7, 4, 1 }, kardex.Select(f => f.SaldoCantidad));
    }
}
