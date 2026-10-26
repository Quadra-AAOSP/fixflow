#requires -Version 7.0
[CmdletBinding()]
param([switch]$MySqlOnly, [switch]$ConfigurationOnly)

$ErrorActionPreference = 'Stop'
$project = 'fixflow-docker-check-' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
$backendRoot = Split-Path $PSScriptRoot -Parent
$composeArgs = @('--project-name', $project, '--env-file', "$PSScriptRoot/compose.env.example", '-f', "$backendRoot/compose.yaml")
$started = $false
function Free-Port {
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $listener.Start()
    try { return $listener.LocalEndpoint.Port } finally { $listener.Stop() }
}
function Compose([string[]]$Arguments) {
    $output = & docker compose @composeArgs @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Compose $($Arguments[0]) failed; credentials were not logged." }
    return ($output -join "`n")
}
function Sql([string]$Statement) {
    $output = $Statement | & docker compose @composeArgs exec -T mysql sh -c 'export MYSQL_PWD="$MYSQL_PASSWORD"; exec mysql --protocol=TCP -h 127.0.0.1 -u "$MYSQL_USER" "$MYSQL_DATABASE" --silent --skip-column-names' 2>&1
    if ($LASTEXITCODE -ne 0) { throw 'Isolated MySQL query failed.' }
    return ($output -join "`n").Trim()
}
$temporary = @{
    DB_NAME='fixflow_docker_check'; DB_USER='fixflow_check'
    DB_PASSWORD=[Guid]::NewGuid().ToString('N'); MYSQL_ROOT_PASSWORD=[Guid]::NewGuid().ToString('N')
    MINIO_ACCESS_KEY='isolated-test-access'; MINIO_SECRET_KEY=[Guid]::NewGuid().ToString('N')
    MINIO_BUCKET='isolated-test-photos'; MINIO_ROOT_USER=''; MINIO_ROOT_PASSWORD=''
    FIXFLOW_SUPER_ADMIN_EMAIL='docker-check@example.test'; FIXFLOW_SUPER_ADMIN_PASSWORD=[Guid]::NewGuid().ToString('N')
    BACKEND_PORT=(Free-Port).ToString(); MYSQL_HOST_PORT=(Free-Port).ToString(); MINIO_HOST_PORT=(Free-Port).ToString()
    BACKEND_BIND_ADDRESS='127.0.0.1'; MINIO_BIND_ADDRESS='127.0.0.1'; SESSION_COOKIE_SECURE='false'
    SEED_DEMO_DATA='false'; OPENROUTER_API_KEY=''; OPENROUTER_VISION_ENABLED='false'; OPENROUTER_RANKING_ENABLED='false'
    CORS_ALLOWED_ORIGIN_PATTERNS='http://localhost:5173'; WEBSOCKET_ALLOWED_ORIGINS='http://localhost:5173'
    MINIO_IMAGE='fixflow-minio:7aac2a2'; BACKEND_IMAGE='fixflow-backend:local'
    PRODUCTION_CORS_ORIGINS='https://frontend.example.test'
    PRODUCTION_WEBSOCKET_ORIGINS='https://frontend.example.test'
    PRODUCTION_MINIO_PUBLIC_ENDPOINT='https://photos.example.test'
}
$temporary.MINIO_PUBLIC_ENDPOINT = "http://127.0.0.1:$($temporary.MINIO_HOST_PORT)"
$original = @{}
foreach ($key in $temporary.Keys) {
    $original[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
    [Environment]::SetEnvironmentVariable($key, $temporary[$key], 'Process')
}
try {
    $local = Compose @('config', '--format', 'json') | ConvertFrom-Json
    if ($local.services.backend.environment.DB_HOST -ne 'mysql' -or
            $local.services.backend.environment.SEED_DEMO_DATA -ne 'false' -or
            $local.services.PSObject.Properties.Name -contains 'rabbitmq') { throw 'Local Compose contract mismatch.' }
    $env:MINIO_ROOT_USER='isolated-test-admin'
    $env:MINIO_ROOT_PASSWORD=[Guid]::NewGuid().ToString('N')
    $production = Compose @('-f', "$backendRoot/compose.production.yaml", 'config', '--format', 'json') | ConvertFrom-Json
    if ($production.services.mysql.ports -or $production.services.minio.ports -or
            $production.services.minio.build -or
            $production.services.backend.environment.SESSION_COOKIE_SECURE -ne 'true') { throw 'Production override contract mismatch.' }
    foreach ($key in $temporary.Keys) { [Environment]::SetEnvironmentVariable($key, $temporary[$key], 'Process') }
    Write-Host 'Local and production Compose contracts passed (no deployment performed).'
    if ($ConfigurationOnly) { return }
    $started = $true
    if ($MySqlOnly) {
        $null = Compose @('up', '-d', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '180', 'mysql')
    } else {
        $null = Compose @('build')
        $null = Compose @('up', '-d', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '240')
        $base = "http://127.0.0.1:$($temporary.BACKEND_PORT)"
        $health = Invoke-RestMethod "$base/actuator/health/readiness" -TimeoutSec 10
        if ($health.status -ne 'UP') { throw 'Backend readiness is not UP.' }
        $session = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
        $csrf = Invoke-RestMethod "$base/api/auth/csrf" -WebSession $session
        $headers = @{}; $headers[$csrf.headerName] = $csrf.token
        $body = @{email=$temporary.FIXFLOW_SUPER_ADMIN_EMAIL; password=$temporary.FIXFLOW_SUPER_ADMIN_PASSWORD} | ConvertTo-Json
        $null = Invoke-RestMethod "$base/api/auth/login" -Method Post -ContentType 'application/json' -Body $body -Headers $headers -WebSession $session
        Write-Host 'Containerized backend readiness and CSRF-protected bootstrap login passed.'
    }
    $null = Sql 'CREATE TABLE docker_smoke (id INT PRIMARY KEY); INSERT INTO docker_smoke VALUES (73);'
    $null = Compose @('up', '-d', '--no-build', '--pull', 'never', '--force-recreate', '--wait', '--wait-timeout', '180', 'mysql')
    if ((Sql 'SELECT id FROM docker_smoke;') -ne '73') { throw 'MySQL volume persistence failed.' }
    Write-Host 'MySQL volume preserved data after container replacement.'
    if (-not $MySqlOnly) {
        $null = Compose @('up', '-d', '--no-build', '--pull', 'never', '--force-recreate', '--wait', '--wait-timeout', '240', 'backend')
        Write-Host 'Backend startup against the existing database passed.'
    }
} finally {
    try {
        if ($started -and $project -match '^fixflow-docker-check-[0-9a-f]{12}$') {
            $null = Compose @('down', '--volumes')
            Write-Host 'Removed only this run''s isolated containers and synthetic-data volumes.'
        }
    } finally {
        foreach ($key in $temporary.Keys) { [Environment]::SetEnvironmentVariable($key, $original[$key], 'Process') }
    }
}
