using BodegaNet.Dominio;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace BodegaNet.Datos;

/// <summary>
/// Modelo común. Cada proveedor (SQLite y PostgreSQL) tiene su propio
/// contexto derivado para mantener sus migraciones por separado.
/// </summary>
public abstract class BodegaDbContext(DbContextOptions options) : DbContext(options)
{
    public DbSet<Producto> Productos => Set<Producto>();

    public DbSet<Bodega> Bodegas => Set<Bodega>();

    public DbSet<Existencia> Existencias => Set<Existencia>();

    public DbSet<Movimiento> Movimientos => Set<Movimiento>();

    public DbSet<Usuario> Usuarios => Set<Usuario>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Producto>(e =>
        {
            e.HasIndex(p => p.Sku).IsUnique();
            e.ToTable(t => t.HasCheckConstraint("CK_Productos_StockMinimo", "\"StockMinimo\" >= 0"));
        });

        modelBuilder.Entity<Bodega>(e => e.HasIndex(b => b.Codigo).IsUnique());

        modelBuilder.Entity<Existencia>(e =>
        {
            e.HasIndex(x => new { x.ProductoId, x.BodegaId }).IsUnique();
            e.Property(x => x.CostoPromedio).HasPrecision(18, 4);
            // Última barrera: aunque falle todo lo demás, la base rechaza un saldo negativo.
            e.ToTable(t => t.HasCheckConstraint("CK_Existencias_Cantidad", "\"Cantidad\" >= 0"));
            e.HasOne(x => x.Producto).WithMany().HasForeignKey(x => x.ProductoId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Bodega).WithMany().HasForeignKey(x => x.BodegaId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Movimiento>(e =>
        {
            e.Property(x => x.Tipo).HasConversion<string>().HasMaxLength(24);
            e.Property(x => x.CostoUnitario).HasPrecision(18, 4);
            e.Property(x => x.SaldoCostoPromedio).HasPrecision(18, 4);
            e.Property(x => x.SaldoValor).HasPrecision(18, 4);
            e.HasIndex(x => new { x.ProductoId, x.BodegaId, x.Id });
            e.HasIndex(x => x.TransferenciaId);
            e.HasOne(x => x.Producto).WithMany().HasForeignKey(x => x.ProductoId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Bodega).WithMany().HasForeignKey(x => x.BodegaId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Usuario>(e => e.HasIndex(u => u.Correo).IsUnique());
    }
}

public sealed class BodegaSqliteContext(DbContextOptions<BodegaSqliteContext> options) : BodegaDbContext(options);

public sealed class BodegaPostgresContext(DbContextOptions<BodegaPostgresContext> options) : BodegaDbContext(options);

/// <summary>Usadas solo por <c>dotnet ef</c> para generar migraciones.</summary>
public sealed class FabricaDisenoSqlite : IDesignTimeDbContextFactory<BodegaSqliteContext>
{
    public BodegaSqliteContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<BodegaSqliteContext>().UseSqlite("Data Source=diseno.db").Options);
}

public sealed class FabricaDisenoPostgres : IDesignTimeDbContextFactory<BodegaPostgresContext>
{
    public BodegaPostgresContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<BodegaPostgresContext>()
            .UseNpgsql("Host=localhost;Database=bodeganet;Username=bodeganet").Options);
}
