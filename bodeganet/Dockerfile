# Etapa 1: compilar y publicar con el SDK.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS compilacion
WORKDIR /fuente
COPY src/BodegaNet/BodegaNet.csproj src/BodegaNet/
RUN dotnet restore src/BodegaNet/BodegaNet.csproj
COPY src/ src/
RUN dotnet publish src/BodegaNet/BodegaNet.csproj -c Release -o /publicado --no-restore /p:UseAppHost=false

# Etapa 2: solo el runtime de ASP.NET Core, con un usuario sin privilegios.
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080 \
    ASPNETCORE_FORWARDEDHEADERS_ENABLED=true \
    SQLITE_RUTA=/datos/bodeganet.db \
    DOTNET_CLI_TELEMETRY_OPTOUT=1
# tzdata para mostrar las fechas en hora de Chile (America/Santiago).
RUN apt-get update \
 && apt-get install -y --no-install-recommends tzdata \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /datos && chown "$APP_UID" /datos
COPY --from=compilacion /publicado .
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "BodegaNet.dll"]
