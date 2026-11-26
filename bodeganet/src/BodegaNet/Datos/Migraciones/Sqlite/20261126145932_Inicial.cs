using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BodegaNet.Datos.Migraciones.Sqlite
{
    /// <inheritdoc />
    public partial class Inicial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Bodegas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Codigo = table.Column<string>(type: "TEXT", maxLength: 12, nullable: false),
                    Nombre = table.Column<string>(type: "TEXT", maxLength: 80, nullable: false),
                    Comuna = table.Column<string>(type: "TEXT", maxLength: 60, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Bodegas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Productos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Sku = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    Nombre = table.Column<string>(type: "TEXT", maxLength: 120, nullable: false),
                    Unidad = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    StockMinimo = table.Column<int>(type: "INTEGER", nullable: false),
                    Activo = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Productos", x => x.Id);
                    table.CheckConstraint("CK_Productos_StockMinimo", "\"StockMinimo\" >= 0");
                });

            migrationBuilder.CreateTable(
                name: "Usuarios",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Correo = table.Column<string>(type: "TEXT", maxLength: 120, nullable: false),
                    Nombre = table.Column<string>(type: "TEXT", maxLength: 80, nullable: false),
                    Rol = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    ClaveHash = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Usuarios", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Existencias",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ProductoId = table.Column<int>(type: "INTEGER", nullable: false),
                    BodegaId = table.Column<int>(type: "INTEGER", nullable: false),
                    Cantidad = table.Column<int>(type: "INTEGER", nullable: false),
                    CostoPromedio = table.Column<decimal>(type: "TEXT", precision: 18, scale: 4, nullable: false),
                    Version = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Existencias", x => x.Id);
                    table.CheckConstraint("CK_Existencias_Cantidad", "\"Cantidad\" >= 0");
                    table.ForeignKey(
                        name: "FK_Existencias_Bodegas_BodegaId",
                        column: x => x.BodegaId,
                        principalTable: "Bodegas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Existencias_Productos_ProductoId",
                        column: x => x.ProductoId,
                        principalTable: "Productos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Movimientos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Fecha = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Tipo = table.Column<string>(type: "TEXT", maxLength: 24, nullable: false),
                    ProductoId = table.Column<int>(type: "INTEGER", nullable: false),
                    BodegaId = table.Column<int>(type: "INTEGER", nullable: false),
                    Cantidad = table.Column<int>(type: "INTEGER", nullable: false),
                    CostoUnitario = table.Column<decimal>(type: "TEXT", precision: 18, scale: 4, nullable: false),
                    SaldoCantidad = table.Column<int>(type: "INTEGER", nullable: false),
                    SaldoCostoPromedio = table.Column<decimal>(type: "TEXT", precision: 18, scale: 4, nullable: false),
                    SaldoValor = table.Column<decimal>(type: "TEXT", precision: 18, scale: 4, nullable: false),
                    Referencia = table.Column<string>(type: "TEXT", maxLength: 120, nullable: true),
                    Usuario = table.Column<string>(type: "TEXT", maxLength: 80, nullable: false),
                    TransferenciaId = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Movimientos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Movimientos_Bodegas_BodegaId",
                        column: x => x.BodegaId,
                        principalTable: "Bodegas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Movimientos_Productos_ProductoId",
                        column: x => x.ProductoId,
                        principalTable: "Productos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Bodegas_Codigo",
                table: "Bodegas",
                column: "Codigo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Existencias_BodegaId",
                table: "Existencias",
                column: "BodegaId");

            migrationBuilder.CreateIndex(
                name: "IX_Existencias_ProductoId_BodegaId",
                table: "Existencias",
                columns: new[] { "ProductoId", "BodegaId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Movimientos_BodegaId",
                table: "Movimientos",
                column: "BodegaId");

            migrationBuilder.CreateIndex(
                name: "IX_Movimientos_ProductoId_BodegaId_Id",
                table: "Movimientos",
                columns: new[] { "ProductoId", "BodegaId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_Movimientos_TransferenciaId",
                table: "Movimientos",
                column: "TransferenciaId");

            migrationBuilder.CreateIndex(
                name: "IX_Productos_Sku",
                table: "Productos",
                column: "Sku",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Usuarios_Correo",
                table: "Usuarios",
                column: "Correo",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Existencias");

            migrationBuilder.DropTable(
                name: "Movimientos");

            migrationBuilder.DropTable(
                name: "Usuarios");

            migrationBuilder.DropTable(
                name: "Bodegas");

            migrationBuilder.DropTable(
                name: "Productos");
        }
    }
}
