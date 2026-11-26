using BodegaNet.Dominio;
using BodegaNet.Servicios;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace BodegaNet.Datos;

/// <summary>
/// Aplica las migraciones y siembra datos ficticios si la base está vacía.
/// Los movimientos de demo pasan por <see cref="ServicioInventario"/>, así el
/// kardex inicial sigue las mismas reglas que uno registrado a mano.
/// </summary>
public static class SemillaDemo
{
    private sealed record Plan(
        string Sku, string Nombre, string Unidad, int Minimo,
        int Entrada1, decimal Costo1, int Entrada2, decimal Costo2,
        int TransferenciaNorte, int SalidaNorte, int SalidaCentral, int TransferenciaSur);

    private static readonly Plan[] Planes =
    [
        new("EMB-001", "Caja de cartón 40x30x30 cm", "un", 200, 600, 420m, 400, 465m, 250, 180, 220, 150),
        new("EMB-002", "Cinta de embalaje transparente 48 mm", "rollo", 60, 120, 890m, 80, 950m, 50, 40, 70, 30),
        new("EMB-003", "Film stretch 50 cm x 300 m", "rollo", 40, 60, 6900m, 30, 7350m, 25, 20, 45, 10),
        new("SEG-001", "Guantes de nitrilo talla M (caja de 100)", "caja", 30, 80, 5400m, 40, 5100m, 30, 26, 40, 15),
        new("SEG-002", "Casco de seguridad blanco", "un", 15, 25, 7990m, 0, 0m, 10, 6, 5, 3),
        new("FER-001", "Tornillo autoperforante 1\" (caja de 500)", "caja", 25, 70, 12500m, 50, 13200m, 30, 22, 25, 15),
        new("FER-002", "Pallet de madera 120x100 cm", "un", 50, 150, 8500m, 100, 9200m, 60, 55, 90, 40),
        new("LIM-001", "Detergente industrial 5 L", "bidón", 20, 40, 11990m, 0, 0m, 15, 12, 18, 6),
        new("ELE-001", "Ampolleta LED 12 W luz fría", "un", 40, 200, 1890m, 100, 1750m, 60, 45, 80, 50),
        new("OFI-001", "Resma papel carta 75 g", "resma", 25, 100, 3990m, 60, 4150m, 30, 28, 50, 20),
    ];

    /// <summary>Credenciales ficticias de la demo (también están en el README).</summary>
    public static readonly (string Correo, string Nombre, string Rol, string Clave)[] UsuariosDemo =
    [
        ("admin@bodeganet.test", "Ana Administradora", Roles.Administrador, "Admin.Demo2026"),
        ("bodega@bodeganet.test", "Bruno Bodeguero", Roles.Bodeguero, "Bodega.Demo2026"),
        ("consulta@bodeganet.test", "Carla Consulta", Roles.Consulta, "Consulta.Demo2026"),
    ];

    public static async Task PrepararAsync(IServiceProvider servicios, CancellationToken ct = default)
    {
        using var alcance = servicios.CreateScope();
        var proveedor = alcance.ServiceProvider;
        var db = proveedor.GetRequiredService<BodegaDbContext>();
        await db.Database.MigrateAsync(ct);

        if (!await db.Usuarios.AnyAsync(ct))
        {
            var hasher = proveedor.GetRequiredService<IPasswordHasher<Usuario>>();
            foreach (var (correo, nombre, rol, clave) in UsuariosDemo)
            {
                var usuario = new Usuario { Correo = correo, Nombre = nombre, Rol = rol };
                usuario.ClaveHash = hasher.HashPassword(usuario, clave);
                db.Usuarios.Add(usuario);
            }

            // El invitado no tiene clave: solo se entra con el botón del login.
            db.Usuarios.Add(new Usuario { Correo = ServicioUsuarios.CorreoInvitado, Nombre = "Invitado", Rol = Roles.Bodeguero });
            await db.SaveChangesAsync(ct);
        }

        if (!await db.Productos.AnyAsync(ct))
        {
            await SembrarInventarioAsync(db, proveedor.GetRequiredService<ServicioInventario>(), ct);
        }
    }

    private static async Task SembrarInventarioAsync(BodegaDbContext db, ServicioInventario inventario, CancellationToken ct)
    {
        var central = new Bodega { Codigo = "CEN", Nombre = "Bodega Central", Comuna = "Rancagua" };
        var norte = new Bodega { Codigo = "NOR", Nombre = "Centro de distribución Norte", Comuna = "Quilicura" };
        var sur = new Bodega { Codigo = "SUR", Nombre = "Bodega Sur", Comuna = "San Fernando" };
        db.Bodegas.AddRange(central, norte, sur);

        var productos = Planes
            .Select(p => new Producto { Sku = p.Sku, Nombre = p.Nombre, Unidad = p.Unidad, StockMinimo = p.Minimo })
            .ToArray();
        db.Productos.AddRange(productos);
        await db.SaveChangesAsync(ct);
        db.ChangeTracker.Clear();

        var inicio = DateTime.UtcNow.Date.AddDays(-30).AddHours(12);
        DateTime Dia(int dia, int i) => inicio.AddDays(dia).AddMinutes(i * 17);
        const string usuario = "Semilla de demo";

        // Se recorre por día para que el orden de los movimientos siga la fecha.
        for (var i = 0; i < Planes.Length; i++)
        {
            var p = Planes[i];
            await inventario.RegistrarEntradaAsync(
                new(productos[i].Id, central.Id, p.Entrada1, p.Costo1, $"Factura proveedor {4100 + i}"), usuario, Dia(1, i), ct);
        }

        for (var i = 0; i < Planes.Length; i++)
        {
            var p = Planes[i];
            if (p.Entrada2 > 0)
            {
                await inventario.RegistrarEntradaAsync(
                    new(productos[i].Id, central.Id, p.Entrada2, p.Costo2, $"Factura proveedor {4200 + i}"), usuario, Dia(8, i), ct);
            }
        }

        for (var i = 0; i < Planes.Length; i++)
        {
            await inventario.RegistrarTransferenciaAsync(
                new(productos[i].Id, central.Id, norte.Id, Planes[i].TransferenciaNorte, null), usuario, Dia(12, i), ct);
        }

        for (var i = 0; i < Planes.Length; i++)
        {
            await inventario.RegistrarSalidaAsync(
                new(productos[i].Id, norte.Id, Planes[i].SalidaNorte, $"Guía de despacho {7300 + i}"), usuario, Dia(15, i), ct);
        }

        for (var i = 0; i < Planes.Length; i++)
        {
            await inventario.RegistrarSalidaAsync(
                new(productos[i].Id, central.Id, Planes[i].SalidaCentral, $"Guía de despacho {7400 + i}"), usuario, Dia(20, i), ct);
        }

        for (var i = 0; i < Planes.Length; i++)
        {
            await inventario.RegistrarTransferenciaAsync(
                new(productos[i].Id, central.Id, sur.Id, Planes[i].TransferenciaSur, null), usuario, Dia(24, i), ct);
        }

        await inventario.RegistrarAjusteAsync(
            new(productos[0].Id, central.Id, -3, "Conteo cíclico: cajas dañadas por humedad"), usuario, Dia(27, 0), ct);
        await inventario.RegistrarAjusteAsync(
            new(productos[6].Id, norte.Id, 2, "Conteo cíclico: sobrante sin registrar"), usuario, Dia(27, 1), ct);
    }
}
