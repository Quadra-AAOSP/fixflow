#requires -Version 7.0
<#
.SYNOPSIS
  Run Docker Compose for FixFlow with an explicit env-file path.

.EXAMPLE
  ./compose.ps1 -EnvFile "$HOME/env/docker.env" -p fixflow-local up -d --build --wait

.EXAMPLE
  $env:COMPOSE_ENV_FILE = 'C:/secrets/fixflow.docker.env'
  ./compose.ps1 config --quiet
#>
[CmdletBinding()]
param(
    [string]$EnvFile = $(
        if ($env:COMPOSE_ENV_FILE) { $env:COMPOSE_ENV_FILE }
        elseif (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'docker.env')) { Join-Path $PSScriptRoot 'docker.env' }
        else { Join-Path $PSScriptRoot 'compose.env.example' }
    ),
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ComposeArgs
)

$ErrorActionPreference = 'Stop'
if (-not $ComposeArgs -or $ComposeArgs.Count -eq 0) {
    throw 'Pass Compose arguments after the optional -EnvFile, e.g. ./compose.ps1 -EnvFile ./docker.env up -d'
}
if (-not (Test-Path -LiteralPath $EnvFile)) {
    throw "Env file not found: $EnvFile (set -EnvFile or COMPOSE_ENV_FILE)"
}

$resolved = (Resolve-Path -LiteralPath $EnvFile).Path
Write-Host "Using env file: $resolved"
& docker compose --project-directory $PSScriptRoot --env-file $resolved @ComposeArgs
exit $LASTEXITCODE
