package com.example.fixflow.service;

import java.io.InputStream;
import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import com.example.fixflow.config.MinioProperties;
import com.example.fixflow.web.ApiException;

import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.http.Method;
import jakarta.annotation.PostConstruct;

@Service
@ConditionalOnProperty(prefix = "fixflow.minio", name = "enabled", havingValue = "true", matchIfMissing = true)
public class MinioStorageService implements ObjectStorageService {

	private static final Logger log = LoggerFactory.getLogger(MinioStorageService.class);

	private final MinioProperties properties;
	private MinioClient client;

	public MinioStorageService(MinioProperties properties) {
		this.properties = properties;
	}

	@PostConstruct
	void init() {
		client = MinioClient.builder()
				.endpoint(properties.endpoint())
				.credentials(properties.accessKey(), properties.secretKey())
				.build();
		try {
			boolean exists = client.bucketExists(BucketExistsArgs.builder().bucket(properties.bucket()).build());
			if (!exists) {
				client.makeBucket(MakeBucketArgs.builder().bucket(properties.bucket()).build());
				log.info("Created MinIO bucket {}", properties.bucket());
			}
		} catch (Exception ex) {
			log.warn("MinIO bucket bootstrap failed for {}: {}", properties.bucket(), ex.getMessage());
		}
	}

	@Override
	public void putObject(String objectKey, InputStream data, long size, String contentType) {
		try {
			client.putObject(PutObjectArgs.builder()
					.bucket(properties.bucket())
					.object(objectKey)
					.stream(data, size, -1)
					.contentType(contentType)
					.build());
		} catch (Exception ex) {
			throw new ApiException(502, "Failed to store report photo: " + ex.getMessage());
		}
	}

	@Override
	public void deleteObject(String objectKey) {
		try {
			client.removeObject(RemoveObjectArgs.builder()
					.bucket(properties.bucket())
					.object(objectKey)
					.build());
		} catch (Exception ex) {
			log.warn("Failed to delete MinIO object {}: {}", objectKey, ex.getMessage());
		}
	}

	@Override
	public String presignedGetUrl(String objectKey, Duration expiry) {
		try {
			return client.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
					.method(Method.GET)
					.bucket(properties.bucket())
					.object(objectKey)
					.expiry((int) Math.max(1, expiry.toSeconds()))
					.build());
		} catch (Exception ex) {
			throw new ApiException(502, "Failed to create photo download URL");
		}
	}

	@Override
	public InputStream getObject(String objectKey) {
		try {
			return client.getObject(GetObjectArgs.builder()
					.bucket(properties.bucket())
					.object(objectKey)
					.build());
		} catch (Exception ex) {
			throw new ApiException(404, "Photo not found in storage");
		}
	}
}
