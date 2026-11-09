package com.example.fixflow.service;

import static org.junit.jupiter.api.Assertions.*;
import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import com.example.fixflow.web.ApiException;

class LocalObjectStorageServiceTest {
    @TempDir Path directory;

    @Test void persistsAcrossInstancesAndDeletes() throws Exception {
        var storage = new LocalObjectStorageService(directory.toString());
        storage.putObject("reports/1/photo.png", new ByteArrayInputStream(new byte[]{1, 2}), 2, "image/png");
        var reopened = new LocalObjectStorageService(directory.toString());
        try (var input = reopened.getObject("reports/1/photo.png")) {
            assertArrayEquals(new byte[]{1, 2}, input.readAllBytes());
        }
        reopened.deleteObject("reports/1/photo.png");
        assertThrows(ApiException.class, () -> reopened.getObject("reports/1/photo.png"));
        assertThrows(UnsupportedOperationException.class, () -> storage.presignedGetUrl("x", Duration.ofMinutes(1)));
    }

    @Test void rejectsTraversal() {
        var storage = new LocalObjectStorageService(directory.toString());
        assertThrows(ApiException.class, () -> storage.putObject("../outside", new ByteArrayInputStream(new byte[0]), 0, "image/png"));
    }
}
