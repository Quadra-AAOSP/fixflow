# Local verification only: archived official source, not a supported production image.
FROM golang:1.24.8-alpine AS build
RUN apk add --no-cache git ca-certificates
WORKDIR /src
RUN git init && git remote add origin https://github.com/minio/minio.git \
    && git fetch --depth 1 origin 7aac2a2c5b7c882e68c1ce017d8256be2feea27f \
    && git checkout --detach FETCH_HEAD
ENV CGO_ENABLED=0
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    go build -trimpath -o /out/minio .

FROM alpine:3.22
RUN apk add --no-cache ca-certificates curl \
    && addgroup -g 10001 minio && adduser -D -u 10001 -G minio minio \
    && mkdir /data && chown minio:minio /data
COPY --from=build /out/minio /usr/local/bin/minio
COPY --from=build /src/LICENSE /src/CREDITS /licenses/
LABEL org.opencontainers.image.source="https://github.com/minio/minio" \
      org.opencontainers.image.revision="7aac2a2c5b7c882e68c1ce017d8256be2feea27f" \
      org.opencontainers.image.licenses="AGPL-3.0-only"
USER minio
EXPOSE 9000
ENTRYPOINT ["minio"]
CMD ["server", "/data"]
