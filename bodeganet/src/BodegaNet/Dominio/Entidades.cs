using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BodegaNet.Dominio;

public static class Roles
{
    public const string Administrador = "Administrador";
    public const string Bodeguero = "Bodeguero";
    public const string Consulta = "Consulta";

    /// <summary>Roles que pueden registrar movimientos.</summary>
    public const string Operadores = Administrador + "," + Bodeguero;
}

public sealed class Producto
{
    public int Id { get; set; }

    [MaxLength(32)]
    public required string Sku { get; set; }

    [MaxLength(120)]
    public required string Nombre { get; set; }

    [MaxLength(16)]
    public required string Unidad { get; set; }

    public int StockMinimo { get; set; }

    public bool Activo { get; set; } = true;
}

public sealed class Bodega
{
    public int Id { get; set; }

    [MaxLength(12)]
    public required string Codigo { get; set; }

    [MaxLength(80)]
    public required string Nombre { get; set; }

    [MaxLength(60)]
    public required string Comuna { get; set; }
}

/// <summary>
/// Saldo de un producto en una bodega. <see cref="Version"/> es el token de
/// concurrencia optimista: cada cambio lo incrementa y el UPDATE solo se
/// aplica si nadie lo cambió desde que se leyó.
/// </summary>
public sealed class Existencia
{
    public int Id { get; set; }

    public int ProductoId { get; set; }

    public Producto? Producto { get; set; }

    public int BodegaId { get; set; }

    public Bodega? Bodega { get; set; }

    public int Cantidad { get; set; }

    public decimal CostoPromedio { get; set; }

    [ConcurrencyCheck]
    public int Version { get; set; }

    [NotMapped]
    public decimal Valor => Math.Round(Cantidad * CostoPromedio, 2);
}

public enum TipoMovimiento
{
    Entrada,
    Salida,
    Ajuste,
    TransferenciaSalida,
    TransferenciaEntrada,
}

/// <summary>
/// Línea del kardex. Guarda el saldo resultante para que el kardex se lea
/// tal como quedó, sin recalcular la historia.
/// </summary>
public sealed class Movimiento
{
    public int Id { get; set; }

    public DateTime Fecha { get; set; }

    public TipoMovimiento Tipo { get; set; }

    public int ProductoId { get; set; }

    public Producto? Producto { get; set; }

    public int BodegaId { get; set; }

    public Bodega? Bodega { get; set; }

    /// <summary>Positiva si entra stock, negativa si sale.</summary>
    public int Cantidad { get; set; }

    public decimal CostoUnitario { get; set; }

    public int SaldoCantidad { get; set; }

    public decimal SaldoCostoPromedio { get; set; }

    public decimal SaldoValor { get; set; }

    [MaxLength(120)]
    public string? Referencia { get; set; }

    [MaxLength(80)]
    public required string Usuario { get; set; }

    public Guid? TransferenciaId { get; set; }

    [NotMapped]
    public decimal ValorMovimiento => Math.Round(Cantidad * CostoUnitario, 2);
}

public sealed class Usuario
{
    public int Id { get; set; }

    [MaxLength(120)]
    public required string Correo { get; set; }

    [MaxLength(80)]
    public required string Nombre { get; set; }

    [MaxLength(20)]
    public required string Rol { get; set; }

    [MaxLength(200)]
    public string ClaveHash { get; set; } = "";
}
