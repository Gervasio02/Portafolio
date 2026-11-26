using System.Globalization;
using System.Text;
using BodegaNet.Dominio;

namespace BodegaNet.Servicios;

/// <summary>Formatos chilenos sin depender de ICU: punto de miles y coma decimal.</summary>
public static class Formato
{
    private static readonly NumberFormatInfo Chile = new()
    {
        NumberGroupSeparator = ".",
        NumberDecimalSeparator = ",",
        NegativeSign = "-",
    };

    private static readonly TimeZoneInfo ZonaChile = BuscarZona();

    public static string Pesos(decimal valor) =>
        (valor < 0 ? "-$" : "$") + Math.Abs(Math.Round(valor, 0, MidpointRounding.AwayFromZero)).ToString("N0", Chile);

    /// <summary>Costo con hasta dos decimales, útil para promedios.</summary>
    public static string Costo(decimal valor) => "$" + Math.Round(valor, 2, MidpointRounding.AwayFromZero).ToString("#,##0.##", Chile);

    public static string Numero(int valor) => valor.ToString("N0", Chile);

    public static string Decimal(decimal valor, int decimales) =>
        Math.Round(valor, decimales, MidpointRounding.AwayFromZero)
            .ToString(decimales > 0 ? "0." + new string('#', decimales) : "0", Chile);

    /// <summary>Entero sin separadores, para atributos HTML como value o max.</summary>
    public static string Entero(decimal valor) =>
        Math.Round(valor, 0, MidpointRounding.AwayFromZero).ToString("0", CultureInfo.InvariantCulture);

    public static DateTime HoraChile(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), ZonaChile);

    public static string Fecha(DateTime utc) => HoraChile(utc).ToString("dd-MM-yyyy HH:mm", CultureInfo.InvariantCulture);

    public static string Tipo(TipoMovimiento tipo) => tipo switch
    {
        TipoMovimiento.Entrada => "Entrada",
        TipoMovimiento.Salida => "Salida",
        TipoMovimiento.Ajuste => "Ajuste",
        TipoMovimiento.TransferenciaSalida => "Transferencia (sale)",
        TipoMovimiento.TransferenciaEntrada => "Transferencia (entra)",
        _ => tipo.ToString(),
    };

    private static TimeZoneInfo BuscarZona()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("America/Santiago");
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            return TimeZoneInfo.Utc;
        }
    }
}

public static class ExportadorCsv
{
    /// <summary>
    /// Kardex en CSV separado por punto y coma (lo que espera Excel en Chile),
    /// con BOM UTF-8 para que respete los acentos.
    /// </summary>
    public static byte[] Kardex(Producto producto, Bodega bodega, IEnumerable<FilaMovimiento> filas)
    {
        var sb = new StringBuilder();
        sb.Append("Kardex;").Append(Celda($"{producto.Sku} {producto.Nombre}")).Append(';').Append(Celda(bodega.Nombre)).Append("\r\n");
        sb.Append("Fecha;Tipo;Referencia;Entrada;Salida;Costo unitario;Saldo;Costo promedio;Saldo valorizado;Usuario\r\n");
        foreach (var f in filas)
        {
            sb.Append(Formato.Fecha(f.Fecha)).Append(';')
                .Append(Celda(Formato.Tipo(f.Tipo))).Append(';')
                .Append(Celda(f.Referencia ?? "")).Append(';')
                .Append(f.Entrada.ToString(CultureInfo.InvariantCulture)).Append(';')
                .Append(f.Salida.ToString(CultureInfo.InvariantCulture)).Append(';')
                .Append(Formato.Decimal(f.CostoUnitario, 4)).Append(';')
                .Append(f.SaldoCantidad.ToString(CultureInfo.InvariantCulture)).Append(';')
                .Append(Formato.Decimal(f.SaldoCostoPromedio, 4)).Append(';')
                .Append(Formato.Decimal(f.SaldoValor, 2)).Append(';')
                .Append(Celda(f.Usuario)).Append("\r\n");
        }

        return [.. Encoding.UTF8.GetPreamble(), .. Encoding.UTF8.GetBytes(sb.ToString())];
    }

    /// <summary>
    /// Escapa comillas y separadores, y neutraliza fórmulas (=, +, -, @) para
    /// que una referencia escrita por un usuario no se ejecute en Excel.
    /// </summary>
    public static string Celda(string valor)
    {
        if (valor.Length > 0 && "=+-@\t\r".Contains(valor[0]))
        {
            valor = "'" + valor;
        }

        return valor.IndexOfAny([';', '"', '\n', '\r']) >= 0
            ? "\"" + valor.Replace("\"", "\"\"") + "\""
            : valor;
    }
}
