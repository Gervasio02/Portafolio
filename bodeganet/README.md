# BodegaNet

Control de inventario y kardex para empresas con varias bodegas, hecho en
.NET 10 con ASP.NET Core. Registra entradas con costo, salidas, ajustes por
conteo y transferencias entre bodegas; lleva el kardex de cada producto en cada
bodega con **costo promedio ponderado**, avisa cuando un producto baja de su
stock mínimo y exporta el kardex a CSV. Todos los datos son ficticios.

Demo: <https://bodeganet-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/>
(botón **Entrar como invitado**). La demo usa SQLite dentro del contenedor:
**se reinicia** cada vez que la app se apaga por inactividad y vuelve a sembrar
los datos de ejemplo.

## Stack

- ASP.NET Core 10 con **Razor Pages** (HTML renderizado en el servidor, sin
  frameworks JS ni CDN) y **minimal APIs** documentadas con OpenAPI
  (`/openapi/v1.json`).
- **Entity Framework Core 10** con migraciones para dos proveedores:
  PostgreSQL (Npgsql) y SQLite.
- Autenticación por cookie con roles, antiforgery en todos los formularios,
  cabeceras de seguridad (CSP sin scripts) y contraseñas con
  `PasswordHasher` (PBKDF2).
- **xUnit** con pruebas unitarias del dominio y pruebas de integración con
  `WebApplicationFactory`. CI las corre dos veces: con SQLite y con PostgreSQL.

## Reglas de negocio (lo difícil)

- **Stock nunca negativo, aunque lleguen dos salidas a la vez.** Cada saldo
  (`Existencia`) tiene un token de concurrencia (`Version`). La operación lee
  el saldo, valida y escribe dentro de una transacción; el `UPDATE` solo se
  aplica si la versión no cambió. Si otra operación ganó la carrera, EF lanza
  `DbUpdateConcurrencyException`, se descarta todo y se reintenta con el saldo
  fresco (hasta 8 veces). Además, la tabla tiene un `CHECK ("Cantidad" >= 0)`
  como última barrera. Las pruebas lanzan 10 salidas simultáneas de 3 unidades
  sobre un saldo de 10 y comprueban que pasan exactamente tres y el saldo final
  es 1.
- **Costo promedio ponderado.** Cada entrada recalcula
  `(saldo × promedio + cantidad × costo) / (saldo + cantidad)`; las salidas se
  valorizan al promedio vigente y no lo cambian. Cada línea del kardex guarda el
  saldo, el promedio y el saldo valorizado que quedaron, así el kardex se lee tal
  como ocurrió.
- **Transferencias atómicas.** La salida del origen y la entrada al destino se
  guardan en la misma transacción y comparten un `TransferenciaId`; el destino
  recibe el costo promedio del origen. Si falta stock, no queda rastro en
  ninguna bodega.
- **Ajustes por conteo** con motivo obligatorio: un sobrante entra al promedio
  vigente y un faltante no puede dejar el saldo bajo cero.
- **CSV seguro para Excel**: separado por punto y coma, con BOM UTF-8, coma
  decimal y celdas que empiezan con `=`, `+`, `-` o `@` neutralizadas.
- SQLite guarda los `decimal` como texto, así que los montos se suman en
  memoria y no en SQL, para no perder exactitud.

## Cuentas de demo (ficticias)

| Rol | Correo | Clave | Puede |
| --- | --- | --- | --- |
| Administrador | `admin@bodeganet.test` | `Admin.Demo2026` | Todo, incluido crear productos y bodegas |
| Bodeguero | `bodega@bodeganet.test` | `Bodega.Demo2026` | Registrar movimientos y consultar |
| Consulta | `consulta@bodeganet.test` | `Consulta.Demo2026` | Solo consultar |
| Invitado | botón **Entrar como invitado** | — | Igual que Bodeguero |

## Ejecutar en el computador

Requiere el SDK de .NET 10.

```bash
cd bodeganet
dotnet run --project src/BodegaNet
# http://localhost:5080
```

Sin variables de entorno usa SQLite en `src/BodegaNet/bin/.../datos/bodeganet.db`,
aplica las migraciones y siembra los datos de demo al arrancar. Borra ese archivo
para empezar de cero.

Con Docker y PostgreSQL:

```bash
cd bodeganet
cp .env.example .env   # cambia POSTGRES_PASSWORD
docker compose up --build
# http://localhost:8080
```

### Variables de entorno

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | PostgreSQL en formato `postgres://usuario:clave@host:5432/base?sslmode=require` o como cadena de Npgsql. Si existe, se usa PostgreSQL. |
| `ConnectionStrings__Default` | Alternativa a `DATABASE_URL` (cadena de Npgsql). |
| `SQLITE_RUTA` | Ruta del archivo SQLite cuando no hay PostgreSQL. En el contenedor: `/datos/bodeganet.db`. |
| `ASPNETCORE_HTTP_PORTS` | Puerto HTTP. El contenedor escucha en `8080`. |

### Puertos

- `dotnet run`: `http://localhost:5080`.
- Contenedor y `docker compose`: `8080`.
- Salud: `GET /health` responde 200 con la cabecera
  `Cross-Origin-Resource-Policy: cross-origin` (el portal la consulta para
  despertar la app).

## Migraciones

Hay un contexto por proveedor (`BodegaSqliteContext` y `BodegaPostgresContext`,
ambos heredan el modelo de `BodegaDbContext`) y cada uno tiene sus migraciones
en `src/BodegaNet/Datos/Migraciones/`. La app las aplica sola al arrancar. Para
agregar una migración después de cambiar el modelo:

```bash
dotnet tool install --global dotnet-ef
cd bodeganet
dotnet ef migrations add NombreDelCambio --project src/BodegaNet --context BodegaSqliteContext --output-dir Datos/Migraciones/Sqlite
dotnet ef migrations add NombreDelCambio --project src/BodegaNet --context BodegaPostgresContext --output-dir Datos/Migraciones/Postgres
```

## Pruebas

```bash
cd bodeganet
dotnet test BodegaNet.sln
# Con PostgreSQL (crea una base temporal por prueba):
BODEGANET_PRUEBAS_POSTGRES="Host=localhost;Username=bodeganet;Password=...;Database=bodeganet" dotnet test BodegaNet.sln
dotnet format BodegaNet.sln --verify-no-changes
```

## API

La API usa la misma cookie que la interfaz; primero inicia sesión con
`POST /api/sesion` (`{"correo": "...", "clave": "..."}`). Sin sesión responde
401 y sin permiso, 403. Los errores de negocio responden `application/problem+json`
con el detalle en español (409 si falta stock).

| Método | Ruta | Rol |
| --- | --- | --- |
| `GET` | `/api/resumen`, `/api/productos`, `/api/bodegas`, `/api/existencias?bodegaId=`, `/api/alertas` | Cualquiera con sesión |
| `GET` | `/api/kardex?productoId=&bodegaId=` y `/api/kardex.csv?...` | Cualquiera con sesión |
| `POST` | `/api/productos` | Administrador |
| `POST` | `/api/movimientos/entrada`, `/salida`, `/ajuste`, `/transferencia` | Administrador o Bodeguero |

## Despliegue

`.github/workflows/bodeganet.yml` prueba la solución en cada push y PR. En
`main` publica la imagen en Azure Container Registry y crea una revisión de la
Container App `bodeganet-gervasio-std` con `scripts/azure-desplegar-app.sh`
(escala a cero sin tráfico). Para que los datos sobrevivan a los reinicios,
Gervasio puede crear el secreto `BODEGANET_DATABASE_URL` en GitHub (Settings →
Secrets and variables → Actions) con la URL de un PostgreSQL; el flujo lo pasa
como `DATABASE_URL` solo si existe.
