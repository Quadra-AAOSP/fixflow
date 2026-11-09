package com.example.fixflow.service;

import java.io.InputStream;
import java.io.IOException;
import java.nio.file.*;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import com.example.fixflow.web.ApiException;

@Service
@ConditionalOnProperty(prefix = "fixflow.minio", name = "enabled", havingValue = "false")
public class LocalObjectStorageService implements ObjectStorageService {
    private final Path root;
    public LocalObjectStorageService(@Value("${fixflow.storage.local-directory:./data/report-photos}") String directory) {
        root = Path.of(directory).toAbsolutePath().normalize();
    }
    private Path resolve(String key) throws IOException {
        Path target = root.resolve(key).normalize();
        if (!target.startsWith(root) || target.equals(root)) throw new ApiException(400, "Invalid photo key");
        Path current = root.getRoot();

        for (Path part : target) {
            current = current.resolve(part);
            if (Files.isSymbolicLink(current)) throw new IOException("Symbolic link in storage path");
        }
        return target;
    }
    @Override public void putObject(String key, InputStream data, long size, String type) {
        Path temporary = null;
        try {
            Path target = resolve(key);
            Files.createDirectories(target.getParent());
            resolve(key);
            temporary = Files.createTempFile(target.getParent(), ".upload-", ".tmp");
            Files.copy(data, temporary, StandardCopyOption.REPLACE_EXISTING);
            Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException ex) { org.slf4j.LoggerFactory.getLogger(LocalObjectStorageService.class).warn("Local photo write failed", ex); throw new ApiException(502, "Local photo storage is unavailable; check storage directory permissions"); }
        finally { if (temporary != null) try { Files.deleteIfExists(temporary); } catch (IOException ignored) { } }
    }
    @Override public InputStream getObject(String key) {
        try { return Files.newInputStream(resolve(key), LinkOption.NOFOLLOW_LINKS); }
        catch (IOException ex) { throw new ApiException(404, "Photo not found in storage"); }
    }
    @Override public void deleteObject(String key) {
        try { Files.deleteIfExists(resolve(key)); }
        catch (IOException ex) { throw new ApiException(502, "Failed to remove stored photo"); }
    }
    @Override public String presignedGetUrl(String key, Duration expiry) {
        throw new UnsupportedOperationException("Local photos require authenticated content URLs");
    }
}
