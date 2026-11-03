# Web photo storage: local and Docker

The same web integration supports both deployments. The browser uploads multipart `file` to `POST /api/reports/{id}/photos`, reads the list with GET, refreshes an expiring link with GET `/{photoId}`, and deletes with DELETE `/{photoId}` after confirmation. It never receives storage credentials or chooses the storage driver.

## Local persistent storage

Run a native MinIO server with a persistent data directory. Configure the backend process, not Vite:

```dotenv
MINIO_ENABLED=true
MINIO_ENDPOINT=http://127.0.0.1:9000
MINIO_PUBLIC_ENDPOINT=http://127.0.0.1:9000
MINIO_BUCKET=fixflow-photos
# Set MINIO_ACCESS_KEY and MINIO_SECRET_KEY in the backend environment.
# They must match the credentials configured on the storage server.
```

This means local disk managed by MinIO. The current backend has no separate filesystem-storage driver. `MINIO_ENABLED=false` selects volatile in-memory storage and returns `memory://` links. Those are not browser image URLs, and restarting the backend loses the stored bytes. The web explains this state instead of rendering a broken image. A direct filesystem driver would require backend work.

## Docker persistent storage

Use the existing `Backend/compose.yaml` and `Backend/docker/README.md`. Copy `docker/compose.env.example` to an ignored environment file and replace its credential placeholders before starting the stack. The compose backend uses `MINIO_ENDPOINT=http://minio:9000`; its browser-facing `MINIO_PUBLIC_ENDPOINT` defaults to `http://localhost:9000`. `MINIO_HOST_PORT` changes the published port; update the public endpoint to match. Named volumes retain the objects across container restarts. Do not remove volumes when preserving photos.

For a native backend with only MinIO in Docker, start the existing compose `minio` service and point the native backend's internal and public endpoints at its published host port. Container DNS `minio` is not a browser address.

For a remote browser, use a browser-reachable HTTPS storage origin, not localhost. Internal and public endpoints must reach the same storage server/bucket. Preserve the signed URL's host, path and query; rewriting them can invalidate its signature. An HTTPS frontend requires HTTPS photo URLs to avoid mixed-content failures. Do not place access keys in `VITE_*` variables or make the bucket publicly readable.

Vite's `API_PROXY_TARGET` selects the backend for `/api` and `/ws`; photo downloads go to the signed URL returned by that backend. No frontend storage-mode switch is needed.

## Acceptance procedure

With an authorized reporter or site administrator and a disposable report:

1. Upload a valid photo (maximum 5 MiB; five per report).
2. Confirm the thumbnail and download URL render; reload and confirm it remains listed.
3. Refresh its URL; verify the new URL renders without altering its signed query.
4. Restart storage/backend without removing data, then verify the photo remains available.
5. Confirm deletion, reload and verify the record disappears. Verify an unauthorized account cannot list or refresh its URLs.
6. Repeat against the other deployment with an isolated database/bucket.

On 3 November 2026 neither `docker` nor `minio` is on this machine's PATH. Consequently persistent upload/restart acceptance has not been executed here. Existing mocked API tests cover request shape, authorization transport, URL filtering and upload limits; they do not establish storage persistence.
