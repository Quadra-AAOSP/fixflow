package com.example.fixflow.service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.UUID;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.example.fixflow.domain.User;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class UserProfilePhotoService {
	private static final long MAX_BYTES = 5L * 1024 * 1024;
	private static final long MAX_PIXELS = 16_000_000L;

	private final UserRepository users;
	private final ObjectStorageService storage;

	public UserProfilePhotoService(UserRepository users, ObjectStorageService storage) {
		this.users = users;
		this.storage = storage;
	}

	@Transactional
	public void upload(MultipartFile file, AppUserDetails actor) {
		if (file == null || file.isEmpty()) throw new ApiException(400, "Choose a profile photo");
		if (file.getSize() > MAX_BYTES) throw new ApiException(422, "Profile photo must be at most 5 MiB");

		byte[] bytes;
		try (InputStream input = file.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
			input.transferTo(output);
			bytes = output.toByteArray();
		} catch (Exception ex) {
			throw new ApiException(400, "Could not read profile photo");
		}

		String contentType = imageType(bytes);
		if (contentType == null || !contentType.equals(normalizeType(file.getContentType()))) {
			throw new ApiException(422, "Profile photo must be a valid JPEG or PNG image");
		}
		try (ImageInputStream imageInput = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
			if (imageInput == null) throw new ApiException(422, "Profile photo is not a readable image");
			var readers = ImageIO.getImageReaders(imageInput);
			if (!readers.hasNext()) throw new ApiException(422, "Profile photo is not a readable image");
			ImageReader reader = readers.next();
			try {
				reader.setInput(imageInput, true, true);
				int width = reader.getWidth(0);
				int height = reader.getHeight(0);
				if (width < 1 || height < 1 || (long) width * height > MAX_PIXELS) {
				throw new ApiException(422, "Profile photo dimensions are invalid or too large");
			}
				if (reader.read(0) == null) throw new ApiException(422, "Profile photo is not a readable image");
			} finally {
				reader.dispose();
			}
		} catch (ApiException ex) {
			throw ex;
		} catch (Exception ex) {
			throw new ApiException(422, "Profile photo is not a readable image");
		}

		User user = findUser(actor);
		String oldKey = user.getProfilePhotoObjectKey();
		String key = "users/" + user.getId() + "/profile/" + UUID.randomUUID()
				+ (contentType.equals("image/png") ? ".png" : ".jpg");
		storage.putObject(key, new ByteArrayInputStream(bytes), bytes.length, contentType);
		user.setProfilePhotoObjectKey(key);
		user.setProfilePhotoContentType(contentType);
		try {
			users.save(user);
		} catch (RuntimeException ex) {
			storage.deleteObject(key);
			throw ex;
		}
		if (oldKey != null && !oldKey.equals(key)) storage.deleteObject(oldKey);
	}

	@Transactional(readOnly = true)
	public Photo read(AppUserDetails actor) {
		User user = findUser(actor);
		if (user.getProfilePhotoObjectKey() == null || user.getProfilePhotoContentType() == null) {
			throw new ApiException(HttpStatus.NOT_FOUND.value(), "Profile photo not found");
		}
		return new Photo(storage.getObject(user.getProfilePhotoObjectKey()), user.getProfilePhotoContentType());
	}

	@Transactional
	public void delete(AppUserDetails actor) {
		User user = findUser(actor);
		String key = user.getProfilePhotoObjectKey();
		if (key == null) return;
		user.setProfilePhotoObjectKey(null);
		user.setProfilePhotoContentType(null);
		users.save(user);
		storage.deleteObject(key);
	}

	private User findUser(AppUserDetails actor) {
		if (actor == null) throw new ApiException(401, "Authentication required");
		return users.findById(actor.getId())
				.orElseThrow(() -> new ApiException(401, "User not found"));
	}

	private static String imageType(byte[] bytes) {
		if (bytes.length >= 8 && (bytes[0] & 0xff) == 0x89 && bytes[1] == 0x50
				&& bytes[2] == 0x4e && bytes[3] == 0x47 && bytes[4] == 0x0d
				&& bytes[5] == 0x0a && bytes[6] == 0x1a && bytes[7] == 0x0a) return "image/png";
		if (bytes.length >= 3 && (bytes[0] & 0xff) == 0xff && (bytes[1] & 0xff) == 0xd8
				&& (bytes[2] & 0xff) == 0xff) return "image/jpeg";
		return null;
	}

	private static String normalizeType(String type) {
		if (type == null) return "";
		int separator = type.indexOf(';');
		return (separator < 0 ? type : type.substring(0, separator)).trim().toLowerCase(java.util.Locale.ROOT);
	}

	public record Photo(InputStream content, String contentType) { }
}