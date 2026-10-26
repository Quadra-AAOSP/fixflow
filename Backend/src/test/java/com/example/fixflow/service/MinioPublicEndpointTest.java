package com.example.fixflow.service;

import static org.assertj.core.api.Assertions.assertThat;
import java.net.URI;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import com.example.fixflow.config.MinioProperties;
import io.minio.MinioClient;

class MinioPublicEndpointTest {
    @Test
    void signsPublicHostnameWithoutContactingTheInternalStorageAddress() {
        var properties = new MinioProperties(true, "http://minio:9000", "test-access",
                "test-secret-not-deployment", "photos", "https://photos.example.test");
        var internal = MinioClient.builder().endpoint(properties.endpoint())
                .credentials(properties.accessKey(), properties.secretKey()).build();
        var storage = new MinioStorageService(properties, internal);
        URI signed = URI.create(storage.presignedGetUrl("reports/1/test.png", Duration.ofMinutes(1)));
        assertThat(signed.getHost()).isEqualTo("photos.example.test");
        assertThat(signed.getScheme()).isEqualTo("https");
        assertThat(signed.getPath()).isEqualTo("/photos/reports/1/test.png");
        assertThat(signed.getQuery()).contains("X-Amz-Signature=", "X-Amz-Expires=60");
        assertThat(new MinioProperties(true, "http://localhost:9000", "key", "secret", "photos")
                .publicEndpoint()).isEqualTo("http://localhost:9000");
    }
}
