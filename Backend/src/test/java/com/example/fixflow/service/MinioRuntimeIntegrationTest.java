package com.example.fixflow.service;

import static org.assertj.core.api.Assertions.assertThat;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import org.testcontainers.containers.wait.strategy.Wait;
import com.example.fixflow.config.MinioProperties;
import io.minio.MinioClient;

/** Isolated storage only; never connects to the deployment bucket. */
@Testcontainers(disabledWithoutDocker = true)
@EnabledIfEnvironmentVariable(named = "MINIO_TEST_IMAGE", matches = ".+")
class MinioRuntimeIntegrationTest {
    @Container
    static final GenericContainer<?> MINIO = new GenericContainer<>(DockerImageName.parse(
            System.getenv().getOrDefault("MINIO_TEST_IMAGE", "minio/minio:unconfigured-test-only")))
            .withEnv("MINIO_ROOT_USER", "runtime-test")
            .withEnv("MINIO_ROOT_PASSWORD", "runtime-test-password")
            .withCommand("server", "/data")
            .withExposedPorts(9000)
            .waitingFor(Wait.forHttp("/minio/health/ready").forPort(9000));

    @Test
    void privateObjectsSurviveServerRestartAndRequireSignedAccess() throws Exception {
        String endpoint = "http://" + MINIO.getHost() + ":" + MINIO.getMappedPort(9000);
        var config = new MinioProperties(true, endpoint, "runtime-test", "runtime-test-password", "runtime-photos");
        var client = MinioClient.builder().endpoint(endpoint)
                .credentials(config.accessKey(), config.secretKey()).build();
        var storage = new MinioStorageService(config, client);
        storage.init();
        byte[] data = "non-sensitive runtime fixture".getBytes(StandardCharsets.UTF_8);
        storage.putObject("reports/fixture/photo.png", new ByteArrayInputStream(data), data.length, "image/png");
        var http = HttpClient.newHttpClient();
        var unsigned = HttpRequest.newBuilder(URI.create(endpoint + "/runtime-photos/reports/fixture/photo.png")).build();
        assertThat(http.send(unsigned, HttpResponse.BodyHandlers.discarding()).statusCode()).isEqualTo(403);
        MINIO.getDockerClient().restartContainerCmd(MINIO.getContainerId()).exec();
        // Readiness after Docker restart is asynchronous; bound retries to this test only.
        long deadline = System.nanoTime() + Duration.ofSeconds(30).toNanos();
        while (true) {
            try (var input = storage.getObject("reports/fixture/photo.png")) {
                assertThat(input.readAllBytes()).isEqualTo(data);
                break;
            } catch (com.example.fixflow.web.ApiException ex) {
                if (System.nanoTime() >= deadline) throw ex;
                Thread.sleep(200);
            }
        }
        var signed = HttpRequest.newBuilder(URI.create(storage.presignedGetUrl(
                "reports/fixture/photo.png", Duration.ofMinutes(1)))).build();
        assertThat(http.send(signed, HttpResponse.BodyHandlers.ofByteArray()).body()).isEqualTo(data);
        storage.deleteObject("reports/fixture/photo.png");
    }
}
