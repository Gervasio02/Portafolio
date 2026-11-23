param(
    [string]$PgBin = "$env:LOCALAPPDATA\CodexTools\postgresql-test\pgsql\bin",
    [string]$StateDirectory = "$env:LOCALAPPDATA\CodexTools\postgresql-test\server",
    [int]$Port = 55432,
    [ValidateSet('All','taskflow','reservaya','tiendanova')][string]$Application = 'All'
)
$ErrorActionPreference = 'Stop'
$repository = Split-Path $PSScriptRoot -Parent
$PgBin = [IO.Path]::GetFullPath($PgBin)
$StateDirectory = [IO.Path]::GetFullPath($StateDirectory)
if (!(Test-Path -LiteralPath "$PgBin\pg_ctl.exe")) { throw 'Indica PgBin con los binarios oficiales de PostgreSQL.' }
New-Item -ItemType Directory -Path $StateDirectory -Force | Out-Null
$dataDirectory = Join-Path $StateDirectory 'data'
$credentialFile = Join-Path $StateDirectory 'credential.xml'
if (!(Test-Path -LiteralPath "$dataDirectory\PG_VERSION")) {
    $secret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    $credential = [PSCredential]::new('portfolio_test', (ConvertTo-SecureString $secret -AsPlainText -Force))
    $credential | Export-Clixml -LiteralPath $credentialFile
    $passwordFile = Join-Path $StateDirectory 'init-password'
    try {
        [IO.File]::WriteAllText($passwordFile, $secret)
        & "$PgBin\initdb.exe" -D $dataDirectory -U portfolio_test --auth=scram-sha-256 --encoding=UTF8 --locale=C --pwfile=$passwordFile
        if ($LASTEXITCODE) { throw 'No se pudo inicializar la base de pruebas.' }
    } finally { if (Test-Path -LiteralPath $passwordFile) { Remove-Item -LiteralPath $passwordFile }; $secret = $null }
}
if (!(Test-Path -LiteralPath $credentialFile)) { throw 'Falta la credencial local; no se modificará un clúster desconocido.' }
$credential = Import-Clixml -LiteralPath $credentialFile
$password = $credential.GetNetworkCredential().Password
$started = $false
$previous = @{}
foreach ($name in @('PGPASSWORD','DATABASE_URL','DIRECT_URL','TEST_DATABASE_URL','RESERVAYA_TEST_DATABASE_URL')) { $previous[$name] = [Environment]::GetEnvironmentVariable($name,'Process') }
function Run-Step([string]$Directory, [scriptblock]$Action) {
    Push-Location (Join-Path $repository $Directory)
    try { & $Action; if ($LASTEXITCODE) { throw "Falló una comprobación en $Directory" } } finally { Pop-Location }
}
try {
    & "$PgBin\pg_ctl.exe" -D $dataDirectory status *> $null
    if ($LASTEXITCODE) {
        & "$PgBin\pg_ctl.exe" -D $dataDirectory -l (Join-Path $StateDirectory 'postgres.log') -o "-h 127.0.0.1 -p $Port" -w start
        if ($LASTEXITCODE) { throw 'No se pudo iniciar PostgreSQL.' }
        $started = $true
    }
    $env:PGPASSWORD = $password
    foreach ($name in @('taskflow_test','reservaya_test','tiendanova_test')) {
        $exists = & "$PgBin\psql.exe" -h 127.0.0.1 -p $Port -U portfolio_test -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$name'"
        if (!$exists) { & "$PgBin\createdb.exe" -h 127.0.0.1 -p $Port -U portfolio_test $name; if ($LASTEXITCODE) { throw 'No se pudo crear una base aislada.' } }
    }
    $rootUrl = "postgresql://portfolio_test:$password@127.0.0.1:$Port"
    if ($Application -in @('All','taskflow')) {
    $env:DATABASE_URL = "$rootUrl/taskflow_test"; $env:TEST_DATABASE_URL = $env:DATABASE_URL
    Run-Step taskflow { npm run db:generate }
    Run-Step taskflow { npm run db:migrate }
    Run-Step taskflow { npm test }
    }
    if ($Application -in @('All','reservaya')) {
    $env:RESERVAYA_TEST_DATABASE_URL = "postgresql+psycopg://portfolio_test:$password@127.0.0.1:$Port/reservaya_test"
    Run-Step reservaya/backend { .\.venv\Scripts\python -m pytest --cov=app --cov-report=term-missing --cov-fail-under=70 }
    }
    if ($Application -in @('All','tiendanova')) {
    $env:DATABASE_URL = "$rootUrl/tiendanova_test"; $env:DIRECT_URL = $env:DATABASE_URL
    Run-Step tiendanova { npx prisma generate }
    Run-Step tiendanova { npm run db:migrate }
    Run-Step tiendanova { npm test }
    }
} finally {
    if ($started) { & "$PgBin\pg_ctl.exe" -D $dataDirectory -m fast -w stop }
    foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name,$previous[$name],'Process') }
    $password = $null
}
