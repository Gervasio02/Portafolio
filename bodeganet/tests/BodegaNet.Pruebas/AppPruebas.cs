using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc.Testing;

namespace BodegaNet.Pruebas;

public sealed partial class AppPruebas(FabricaBodegaNet fabrica) : IClassFixture<FabricaBodegaNet>
{
    private HttpClient Cliente() => fabrica.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    private static async Task<HttpClient> ConSesionAsync(HttpClient cliente, string correo, string clave)
    {
        var respuesta = await cliente.PostAsJsonAsync("/api/sesion", new { correo, clave });
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        return cliente;
    }

    [GeneratedRegex("name=\"__RequestVerificationToken\" type=\"hidden\" value=\"([^\"]+)\"")]
    private static partial Regex TokenAntiforgery();

    private static async Task<string> TokenAsync(HttpClient cliente, string ruta)
    {
        var html = await cliente.GetStringAsync(ruta);
        var coincidencia = TokenAntiforgery().Match(html);
        Assert.True(coincidencia.Success, "El formulario no trae token antiforgery.");
        return coincidencia.Groups[1].Value;
    }

    [Fact]
    public async Task SaludRespondeYPermiteConsultasDesdeOtroOrigen()
    {
        var respuesta = await Cliente().GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        Assert.Equal("cross-origin", respuesta.Headers.GetValues("Cross-Origin-Resource-Policy").Single());
    }

    [Fact]
    public async Task SinSesionLaInterfazRedirigeAlLoginYLaApiResponde401()
    {
        var cliente = Cliente();

        var panel = await cliente.GetAsync("/");
        Assert.Equal(HttpStatusCode.Redirect, panel.StatusCode);
        Assert.StartsWith("/Login", panel.Headers.Location!.PathAndQuery);

        var api = await cliente.GetAsync("/api/productos");
        Assert.Equal(HttpStatusCode.Unauthorized, api.StatusCode);
    }

    [Fact]
    public async Task ElInvitadoEntraConUnClicYVeElPanel()
    {
        var cliente = Cliente();
        var token = await TokenAsync(cliente, "/Login");

        var respuesta = await cliente.PostAsync("/Login?handler=Invitado",
            new FormUrlEncodedContent(new Dictionary<string, string> { ["__RequestVerificationToken"] = token }));
        Assert.Equal(HttpStatusCode.Redirect, respuesta.StatusCode);

        var panel = await cliente.GetStringAsync("/");
        Assert.Contains("Valor del inventario", panel);
        Assert.Contains("Invitado", panel);
    }

    [Fact]
    public async Task LoginSinTokenAntiforgerySeRechaza()
    {
        var respuesta = await Cliente().PostAsync("/Login?handler=Invitado", new FormUrlEncodedContent([]));
        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
    }

    [Fact]
    public async Task ClaveIncorrectaMuestraUnMensajeClaro()
    {
        var cliente = Cliente();
        var token = await TokenAsync(cliente, "/Login");

        var respuesta = await cliente.PostAsync("/Login", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["__RequestVerificationToken"] = token,
            ["Datos.Correo"] = "admin@bodeganet.test",
            ["Datos.Clave"] = "no-es-la-clave",
        }));

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        Assert.Contains("Correo o clave incorrectos.", await respuesta.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task ElFormularioDeSalidaMuestraElErrorDeStockEnEspanol()
    {
        var cliente = await ConSesionAsync(Cliente(), "bodega@bodeganet.test", "Bodega.Demo2026");
        var token = await TokenAsync(cliente, "/Movimientos/Salida");

        var respuesta = await cliente.PostAsync("/Movimientos/Salida", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["__RequestVerificationToken"] = token,
            ["Datos.ProductoId"] = "1",
            ["Datos.BodegaId"] = "1",
            ["Datos.Cantidad"] = "999999",
        }));

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        Assert.Contains("Stock insuficiente", await respuesta.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task LaDemoTraeAlertasYValorDeInventario()
    {
        var cliente = await ConSesionAsync(Cliente(), "consulta@bodeganet.test", "Consulta.Demo2026");

        var alertas = await cliente.GetFromJsonAsync<JsonElement>("/api/alertas");
        var skus = alertas.EnumerateArray().Select(a => a.GetProperty("sku").GetString()).ToList();
        Assert.Equal(new string?[] { "EMB-003", "LIM-001", "SEG-002" }, skus);

        var resumen = await cliente.GetFromJsonAsync<JsonElement>("/api/resumen");
        Assert.True(resumen.GetProperty("valorTotal").GetDecimal() > 0);
        Assert.Equal(3, resumen.GetProperty("bodegas").GetArrayLength());
    }

    [Fact]
    public async Task ElRolConsultaNoPuedeRegistrarMovimientos()
    {
        var cliente = await ConSesionAsync(Cliente(), "consulta@bodeganet.test", "Consulta.Demo2026");

        var respuesta = await cliente.PostAsJsonAsync("/api/movimientos/salida",
            new { productoId = 1, bodegaId = 1, cantidad = 1 });

        Assert.Equal(HttpStatusCode.Forbidden, respuesta.StatusCode);
    }

    [Fact]
    public async Task SalidasSimultaneasPorLaApiNuncaDejanStockNegativo()
    {
        var admin = await ConSesionAsync(Cliente(), "admin@bodeganet.test", "Admin.Demo2026");
        var creado = await admin.PostAsJsonAsync("/api/productos",
            new { sku = "CON-001", nombre = "Producto para concurrencia", unidad = "un", stockMinimo = 0 });
        Assert.Equal(HttpStatusCode.Created, creado.StatusCode);
        var productoId = (await creado.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var bodegas = await admin.GetFromJsonAsync<JsonElement>("/api/bodegas");
        var bodegaId = bodegas[0].GetProperty("id").GetInt32();
        var entrada = await admin.PostAsJsonAsync("/api/movimientos/entrada",
            new { productoId, bodegaId, cantidad = 10, costoUnitario = 2500m, referencia = "Factura 1" });
        Assert.Equal(HttpStatusCode.OK, entrada.StatusCode);

        var respuestas = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ =>
            admin.PostAsJsonAsync("/api/movimientos/salida", new { productoId, bodegaId, cantidad = 3 })));

        Assert.Equal(3, respuestas.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.Equal(5, respuestas.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        var existencias = await admin.GetFromJsonAsync<JsonElement>($"/api/existencias?bodegaId={bodegaId}");
        var saldo = existencias.EnumerateArray().Single(e => e.GetProperty("productoId").GetInt32() == productoId);
        Assert.Equal(1, saldo.GetProperty("cantidad").GetInt32());
    }

    [Fact]
    public async Task ElKardexSeExportaACsv()
    {
        var cliente = await ConSesionAsync(Cliente(), "consulta@bodeganet.test", "Consulta.Demo2026");

        var respuesta = await cliente.GetAsync("/api/kardex.csv?productoId=1&bodegaId=1");

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        Assert.Equal("text/csv", respuesta.Content.Headers.ContentType!.MediaType);
        var texto = await respuesta.Content.ReadAsStringAsync();
        Assert.Contains("Fecha;Tipo;Referencia;Entrada;Salida", texto);
        Assert.Contains("Factura proveedor 4100", texto);
    }

    [Fact]
    public async Task LasPaginasPrincipalesCargan()
    {
        var cliente = await ConSesionAsync(Cliente(), "admin@bodeganet.test", "Admin.Demo2026");

        foreach (var ruta in new[]
        {
            "/", "/Productos", "/Productos/Editar", "/Productos/Editar/1", "/Bodegas", "/Bodegas/Nueva",
            "/Movimientos", "/Movimientos?Tipo=Entrada", "/Movimientos/Entrada", "/Movimientos/Salida",
            "/Movimientos/Ajuste", "/Movimientos/Transferencia", "/Kardex", "/Kardex?productoId=1",
            "/Alertas", "/Api",
        })
        {
            var respuesta = await cliente.GetAsync(ruta);
            Assert.True(respuesta.StatusCode == HttpStatusCode.OK, $"{ruta} respondió {(int)respuesta.StatusCode}");
        }
    }

    [Fact]
    public async Task ElDocumentoOpenApiEstaDisponible()
    {
        var documento = await Cliente().GetFromJsonAsync<JsonElement>("/openapi/v1.json");

        Assert.True(documento.GetProperty("paths").TryGetProperty("/api/movimientos/salida", out _));
    }
}
