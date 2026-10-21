package com.example.fixflow.service;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import com.example.fixflow.web.ApiException;

@Service
@ConditionalOnProperty(prefix = "fixflow.minio", name = "enabled", havingValue = "false")
public class InMemoryObjectStorageService implements ObjectStorageService {

	private final Map<String, byte[]> objects = new ConcurrentHashMap<>();

	@Override
	public void putObject(String objectKey, InputStream data, long size, String contentType) {
		try {
			objects.put(objectKey, data.readAllBytes());
		} catch (Exception ex) {
			throw new ApiException(502, "Failed to store report photo");
		}
	}

	@Override
	public void deleteObject(String objectKey) {
		objects.remove(objectKey);
	}

	@Override
	public String presignedGetUrl(String objectKey, Duration expiry) {
		if (!objects.containsKey(objectKey)) {
			throw new ApiException(404, "Photo not found in storage");
		}
		return "memory://" + objectKey + "?ttl=" + expiry.toSeconds();
	}

	@Override
	public InputStream getObject(String objectKey) {
		byte[] bytes = objects.get(objectKey);
		if (bytes == null) {
			throw new ApiException(404, "Photo not found in storage");
		}
		return new ByteArrayInputStream(bytes);
	}
}
