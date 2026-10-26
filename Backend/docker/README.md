# Docker runtime

No Spring or Compose profiles are used. `compose.yaml` defines the local backend,
MySQL and MinIO. `compose.production.yaml` is an override, not a second standalone
stack. RabbitMQ was removed because the backend does not use it.

## Local setup

Create a separate ignored `docker.env` alongside your existing external `backend.env`,
using `docker/compose.env.example` as the template. Replace all `CHANGE_ME` values;
use a non-root `DB_USER` and distinct application/root database passwords. Do not
copy the native database credentials or point Docker at your native MySQL data.
Compose passes only named settings, replacing hostnames with Docker service names.
The env file is for Compose interpolation, not copied into the image or mounted.
Existing database passwords are not changed by editing the file after initialization.

From `Backend/`:

```powershell
docker compose --env-file "C:/Users/kwadw/Desktop/ME/CNU/Fourth_year/env/docker.env" -p fixflow-local config --quiet
docker compose --env-file "C:/Users/kwadw/Desktop/ME/CNU/Fourth_year/env/docker.env" -p fixflow-local up -d --build --wait
docker compose --env-file "C:/Users/kwadw/Desktop/ME/CNU/Fourth_year/env/docker.env" -p fixflow-local ps
```

Defaults: API `127.0.0.1:8080`, MySQL `127.0.0.1:3307`, storage `127.0.0.1:9000`.
If a native backend already owns 8080, set `BACKEND_PORT=8082` in docker.env; do not
kill that backend implicitly. For a phone, deliberately bind both API and storage
to the trusted LAN interface (`BACKEND_BIND_ADDRESS` and `MINIO_BIND_ADDRESS`), set
`MINIO_PUBLIC_ENDPOINT=http://YOUR_PC_LAN_IP:9000`, and configure exact frontend origins.
The phone cannot use localhost to reach the PC. Keep Secure false only for local HTTP.

`MINIO_ENDPOINT` is internal object I/O; `MINIO_PUBLIC_ENDPOINT` signs browser/phone
download URLs. Both must target the same bucket/server, preserving the Host header
through a proxy. The current MinIO signing region is its default `us-east-1`.
Local MinIO uses the configured access/secret pair as administrator credentials;
this is not a production least-privilege setup. Its console is disabled.

MySQL and MinIO use project-scoped named volumes. Normal `down` preserves data.
Do not add `--volumes` to a real stack unless you intend permanent deletion of
its databases/photos. Use the same project name/env file every time you restart.
The backend initializes its own tables; no duplicate SQL init mount is needed.
Demo data remains off unless explicitly enabled in a local env file. Production
forces it off. Original seeders remain intact and mutually exclusive with demo loading.

## Isolated verification

```powershell
./docker/Test-Docker.ps1 -ConfigurationOnly
./docker/Test-Docker.ps1 -MySqlOnly
./docker/Test-Docker.ps1
```

Requires PowerShell 7 and Docker Compose supporting `!override`/`!reset` (2.24.4+).
The script creates random test-only credentials, free loopback ports and a unique
`fixflow-docker-check-*` project. It checks both Compose contracts, runs MySQL with
the application account, writes a synthetic row, replaces the database container
and verifies the row survived. Full mode also builds both images, waits for backend
readiness, verifies CSRF-protected login and restarts the app against the existing DB.
Only its own temporary containers/volumes are removed; native services and other
Docker projects are untouched. Credentials and resolved configuration are not logged.

After building the local storage image, independently check private access and restart:

```powershell
$env:MINIO_TEST_IMAGE = 'fixflow-minio:7aac2a2'
./mvnw.cmd '-Dtest=MinioRuntimeIntegrationTest' test
```

## Storage image and build requirements

The former Docker Hub/Quay community image references were unavailable during checks.
Local Compose therefore builds official source at immutable revision
`7aac2a2c5b7c882e68c1ce017d8256be2feea27f`, with source/license labels and license files.
MinIO's official repository is archived and source-only; this test build is **not**
a maintained production distribution or security approval. See
[official source/build guidance](https://github.com/minio/minio).
Do not redistribute without the appropriate license/source compliance review.

Java, Go and Alpine base images, Maven artifacts, Go modules and official source
must be downloadable on the builder. Docker Hub authentication timed out on this PC
during the recorded build attempts. Fix registry/DNS/proxy access before retrying;
do not disable TLS or substitute an unknown public mirror. No network settings were changed.

## Production override

```powershell
docker compose --env-file "PATH/production.env" -p fixflow-production -f compose.yaml -f compose.production.yaml config --quiet
```

Do not run production `up` until deployment review.
Start from `docker/production.env.example`, not the local env file. Its required
`PRODUCTION_CORS_ORIGINS`, `PRODUCTION_WEBSOCKET_ORIGINS` and
`PRODUCTION_MINIO_PUBLIC_ENDPOINT` prevent accidental reuse of local HTTP defaults.
Set an approved supported, immutable `MINIO_IMAGE`; the override disables the archived local source build.
Pre-provision the private bucket and a restricted application service account with
only required bucket/object permissions. Supply separate `MINIO_ROOT_USER` and
`MINIO_ROOT_PASSWORD` for storage administration; never use those as app credentials.
MySQL grants the application account schema-scoped privileges needed by current
startup initialization; it is not a CRUD-only account. Use separate backups and
review a privileged setup/runtime split before deployment.

The override removes database/storage host ports, keeps the API on host loopback,
forces Secure cookies and disables demo/vision/ranking activation. Configure approved
exact HTTPS origins and an HTTPS storage endpoint. Your proxy must have deliberate
network access to storage (for example, an approved proxy joined to the stack network),
pass correct forwarding/Host headers, and not expose MinIO administration.
Readiness includes the database, but not the private storage probe; Compose only
checks initial dependency health and does not repair a failed dependency automatically.
Restart policies restart exited containers, not merely unhealthy ones.

TLS/proxy behavior, production image/security scans, restricted credentials,
backup/restore, retention and operational monitoring still require deployment evidence.
No real deployment, credential rotation or production approval was performed here.
