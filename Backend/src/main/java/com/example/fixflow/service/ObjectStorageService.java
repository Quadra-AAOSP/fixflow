package com.example.fixflow.service;

import java.io.InputStream;
import java.time.Duration;

public interface ObjectStorageService {

	void putObject(String objectKey, InputStream data, long size, String contentType);

	void deleteObject(String objectKey);

	String presignedGetUrl(String objectKey, Duration expiry);

	InputStream getObject(String objectKey);
}
