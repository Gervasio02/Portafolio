namespace BodegaNet.Dominio;

/// <summary>Error de negocio con un mensaje que se puede mostrar tal cual.</summary>
public class ReglaInventarioException(string mensaje) : Exception(mensaje);

public sealed class StockInsuficienteException(string producto, string bodega, int disponible, int solicitado)
    : ReglaInventarioException(
        $"Stock insuficiente de {producto} en {bodega}: hay {disponible} y se pidieron {solicitado}.")
{
    public int Disponible { get; } = disponible;
}

public sealed class NoEncontradoException(string mensaje) : ReglaInventarioException(mensaje);

/// <summary>Se agotaron los reintentos porque otra operación cambió el mismo saldo.</summary>
public sealed class ConflictoConcurrenciaException()
    : ReglaInventarioException("Otra operación modificó el mismo stock al mismo tiempo. Intenta de nuevo.");
