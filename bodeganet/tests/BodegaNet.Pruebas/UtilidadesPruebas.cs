using System.Text;
using BodegaNet.Datos;
using BodegaNet.Dominio;
using BodegaNet.Servicios;
using Npgsql;

namespace BodegaNet.Pruebas;

public sealed class UtilidadesPruebas
{
    [Theory]
    [InlineData("Factura 12", "Factura 12")]
    [InlineData("=HYPERLINK(\"x\")", "\"'=HYPERLINK(\"\"x\"\")\"")]
    [InlineData("+56 9", "'+56 9")]
    [InlineData("-3", "'-3")]
    [InlineData("@SUM(A1)", "'@SUM(A1)")]
    [InlineData("a;b", "\"a;b\"")]
    public void CeldaCsvEscapaSeparadoresYNeutralizaFormulas(string valor, string esperado)
    {
        Assert.Equal(esperado, ExportadorCsv.Celda(valor));
    }

    [Fact]
    public void KardexCsvUsaPuntoYComaYComaDecimal()
    {
        var producto = new Producto { Sku = "EMB-001", Nombre = "Caja", Unidad = "un" };
        var bodega = new Bodega { Codigo = "CEN", Nombre = "Central", Comuna = "Rancagua" };
        var fila = new FilaMovimiento(1, new DateTime(2026, 11, 2, 15, 0, 0, DateTimeKind.Utc), TipoMovimiento.Entrada,
            1, "EMB-001", "Caja", 1, "Central", 3, 1234.5m, 3, 1234.5m, 3703.5m, "Factura 1", "pruebas");

        var texto = Encoding.UTF8.GetString(ExportadorCsv.Kardex(producto, bodega, [fila]));

        Assert.StartsWith("﻿", texto);
        var lineas = texto.TrimStart('﻿').Split("\r\n", StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal("Kardex;EMB-001 Caja;Central", lineas[0]);
        Assert.StartsWith("Fecha;Tipo;Referencia;Entrada;Salida", lineas[1]);
        Assert.EndsWith(";Entrada;Factura 1;3;0;1234,5;3;1234,5;3703,5;pruebas", lineas[2]);
    }

    [Fact]
    public void FormatoChilenoUsaPuntoDeMiles()
    {
        Assert.Equal("$1.234.568", Formato.Pesos(1234567.5m));
        Assert.Equal("-$1.000", Formato.Pesos(-1000m));
        Assert.Equal("$1.150,25", Formato.Costo(1150.25m));
        Assert.Equal("12.345", Formato.Numero(12345));
    }

    [Fact]
    public void ConvierteDatabaseUrlAlFormatoDeNpgsql()
    {
        var cadena = new NpgsqlConnectionStringBuilder(
            ConfiguracionBaseDatos.DesdeUrl("postgres://bodega:cl%40ve@db.ejemplo.cl:6543/inventario?sslmode=require"));

        Assert.Equal("db.ejemplo.cl", cadena.Host);
        Assert.Equal(6543, cadena.Port);
        Assert.Equal("inventario", cadena.Database);
        Assert.Equal("bodega", cadena.Username);
        Assert.Equal("cl@ve", cadena.Password);
        Assert.Equal(SslMode.Require, cadena.SslMode);
        Assert.Equal("Host=x;Database=y", ConfiguracionBaseDatos.DesdeUrl("Host=x;Database=y"));
    }
}
