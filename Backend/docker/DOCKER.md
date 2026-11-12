# Docker runtime

All Docker assets live in `Backend/docker/`:

| File | Purpose |
|------|---------|
| `Dockerfile` | Backend image (build context is `Backend/`) |
| `compose.yaml` | Local stack: backend, MySQL, MinIO |
| `compose.production.yaml` | Production override (not a second stack) |
| `compose.env.example` | Local Compose env template |
| `production.env.example` | Production Compose env template |
| `compose.sh` / `compose.ps1` | Wrappers that take an env-file path |
| `Test-Docker.ps1` | Isolated Compose contract / smoke checks |

`.dockerignore` stays in `Backend/` because that is the image build context.

No Spring or Compose profiles are used. RabbitMQ is not part of the stack.

## Env file path

Compose interpolation secrets come from a file you choose. Do **not** commit real secrets.

```bash
cd Backend/docker

# Bash — pass any absolute or relative path
./compose.sh --env-file /absolute/path/to/docker.env -p fixflow-local up -d --build --wait

# Or via environment variable
COMPOSE_ENV_FILE=/absolute/path/to/docker.env ./compose.sh -p fixflow-local ps

# Raw docker compose (same idea)
docker compose --env-file /absolute/path/to/docker.env -p fixflow-local up -d --build
```

```powershell
cd Backend/docker

# PowerShell
./compose.ps1 -EnvFile "C:\secrets\fixflow.docker.env" -p fixflow-local up -d --build --wait

$env:COMPOSE_ENV_FILE = 'C:\secrets\fixflow.docker.env'
./compose.ps1 -p fixflow-local ps
```

Defaults when no path is given: `./docker.env` if present, otherwise `./compose.env.example`.

Copy `compose.env.example` outside Git, replace every `CHANGE_ME`, and use a non-root
`DB_USER` with distinct application/root database passwords. Do not reuse native MySQL
credentials or point Docker volumes at your host MySQL data directory.

## Local defaults

API `127.0.0.1:8080`, MySQL `127.0.0.1:3307`, storage `127.0.0.1:9000`.

If a native backend already owns 8080, set `BACKEND_PORT=8082` in your env file.
For a phone on the LAN, set `BACKEND_BIND_ADDRESS` and `MINIO_BIND_ADDRESS` to the
trusted interface and `MINIO_PUBLIC_ENDPOINT=http://YOUR_PC_LAN_IP:9000`.

`MINIO_ENDPOINT` is internal object I/O (`http://minio:9000` inside Compose).
`MINIO_PUBLIC_ENDPOINT` is used for browser/phone signed download URLs.

## Isolated verification

```powershell
cd Backend/docker
./Test-Docker.ps1 -ConfigurationOnly
./Test-Docker.ps1 -MySqlOnly
./Test-Docker.ps1
./Test-Docker.ps1 -EnvFile "C:\secrets\fixflow.docker.env" -ConfigurationOnly
```

Requires PowerShell 7 and Docker Compose 2.24.4+ (`!override` / `!reset`).

Optional MinIO client integration test (uses a running image):

```powershell
$env:MINIO_TEST_IMAGE = 'minio/minio:RELEASE.2025-09-07T16-13-09Z'
./mvnw.cmd '-Dtest=MinioRuntimeIntegrationTest' test
```

## Storage image

Local Compose pulls `minio/minio:RELEASE.2025-09-07T16-13-09Z` by default.
Override with `MINIO_IMAGE` in your env file if needed.

Production must set an approved immutable `MINIO_IMAGE` via `compose.production.yaml`.

## Production override

```bash
cd Backend/docker
./compose.sh --env-file /absolute/path/to/production.env \
  -p fixflow-production -f compose.yaml -f compose.production.yaml config --quiet
```

Start from `production.env.example`. Required production-only keys:
`PRODUCTION_CORS_ORIGINS`, `PRODUCTION_WEBSOCKET_ORIGINS`,
`PRODUCTION_MINIO_PUBLIC_ENDPOINT`. Do not run production `up` until deployment review.
