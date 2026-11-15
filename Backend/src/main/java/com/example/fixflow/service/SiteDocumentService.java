package com.example.fixflow.service;

import java.io.InputStream;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.dto.SiteResponse;
import com.example.fixflow.repository.SiteRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class SiteDocumentService {

	public enum Kind { terms, contract }

	private static final long MAX_BYTES = 10L * 1024 * 1024;
	private static final Set<String> ALLOWED = Set.of(
			"application/pdf",
			"application/msword",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"text/plain"
	);

	private final SiteRepository sites;
	private final ObjectStorageService storage;

	public SiteDocumentService(SiteRepository sites, ObjectStorageService storage) {
		this.sites = sites;
		this.storage = storage;
	}

	@Transactional
	public SiteResponse upload(Long siteId, Kind kind, MultipartFile file, AppUserDetails actor) {
		Site site = managedSite(siteId, actor);
		validate(file);
		String contentType = normalize(file.getContentType());
		String extension = extensionFor(contentType, file.getOriginalFilename());
		String objectKey = "sites/" + siteId + "/" + kind.name().toLowerCase(Locale.ROOT)
				+ "/" + UUID.randomUUID() + "." + extension;
		String previous = kind == Kind.terms ? site.getTermsDocumentKey() : site.getContractTermsDocumentKey();
		try (InputStream stream = file.getInputStream()) {
			storage.putObject(objectKey, stream, file.getSize(), contentType);
		} catch (ApiException ex) {
			throw ex;
		} catch (Exception ex) {
			throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR.value(),
					"Failed to upload document: " + ex.getMessage());
		}
		String filename = safeName(file.getOriginalFilename());
		if (kind == Kind.terms) {
			site.setTermsDocumentKey(objectKey);
			site.setTermsDocumentName(filename);
			if (site.getTermsText() == null || site.getTermsText().isBlank()) {
				site.setTermsText(filename);
			}
		} else {
			site.setContractTermsDocumentKey(objectKey);
			site.setContractTermsDocumentName(filename);
			if (site.getContractTermsText() == null || site.getContractTermsText().isBlank()) {
				site.setContractTermsText(filename);
			}
		}
		sites.save(site);
		if (previous != null && !previous.isBlank() && !previous.equals(objectKey)) {
			try {
				storage.deleteObject(previous);
			} catch (Exception ignored) {
				// Keep the new document even if the previous object cannot be deleted.
			}
		}
		return SiteResponse.from(site);
	}

	@Transactional(readOnly = true)
	public InputStream content(Long siteId, Kind kind, AppUserDetails actor) {
		Site site = viewableSite(siteId, actor);
		String key = kind == Kind.terms ? site.getTermsDocumentKey() : site.getContractTermsDocumentKey();
		if (key == null || key.isBlank()) {
			throw new ApiException(HttpStatus.NOT_FOUND.value(), "Document not found");
		}
		return storage.getObject(key);
	}

	@Transactional(readOnly = true)
	public String contentType(Long siteId, Kind kind, AppUserDetails actor) {
		Site site = viewableSite(siteId, actor);
		String name = kind == Kind.terms ? site.getTermsDocumentName() : site.getContractTermsDocumentName();
		if (name == null) return "application/octet-stream";
		String lower = name.toLowerCase(Locale.ROOT);
		if (lower.endsWith(".pdf")) return "application/pdf";
		if (lower.endsWith(".doc")) return "application/msword";
		if (lower.endsWith(".docx")) {
			return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
		}
		if (lower.endsWith(".txt")) return "text/plain";
		return "application/octet-stream";
	}

	@Transactional(readOnly = true)
	public String filename(Long siteId, Kind kind, AppUserDetails actor) {
		Site site = viewableSite(siteId, actor);
		String name = kind == Kind.terms ? site.getTermsDocumentName() : site.getContractTermsDocumentName();
		return name == null || name.isBlank() ? kind.name().toLowerCase(Locale.ROOT) + ".bin" : name;
	}

	private Site managedSite(Long siteId, AppUserDetails actor) {
		Site site = sites.findById(siteId)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Site not found"));
		if (actor.getRole() == UserRole.super_admin) return site;
		if (actor.getRole() == UserRole.admin && actor.getSiteId() != null && actor.getSiteId().equals(siteId)) {
			return site;
		}
		throw new ApiException(HttpStatus.FORBIDDEN.value(), "Only this site's admin can upload documents");
	}

	private Site viewableSite(Long siteId, AppUserDetails actor) {
		Site site = sites.findById(siteId)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Site not found"));
		if (actor.getRole() == UserRole.super_admin) return site;
		if (actor.getSiteId() != null && actor.getSiteId().equals(siteId)) return site;
		throw new ApiException(HttpStatus.FORBIDDEN.value(), "Not allowed to view this site document");
	}

	private void validate(MultipartFile file) {
		if (file == null || file.isEmpty()) {
			throw new ApiException(HttpStatus.BAD_REQUEST.value(), "Empty document upload");
		}
		if (file.getSize() > MAX_BYTES) {
			throw new ApiException(422, "Each document must be at most 10 MiB");
		}
		String contentType = normalize(file.getContentType());
		String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
		boolean allowedType = ALLOWED.contains(contentType)
				|| name.endsWith(".pdf") || name.endsWith(".doc") || name.endsWith(".docx") || name.endsWith(".txt");
		if (!allowedType) {
			throw new ApiException(422, "Document must be PDF, Word, or plain text");
		}
	}

	private static String normalize(String contentType) {
		if (contentType == null || contentType.isBlank()) return "";
		String normalized = contentType.trim().toLowerCase(Locale.ROOT);
		int semi = normalized.indexOf(';');
		return semi >= 0 ? normalized.substring(0, semi).trim() : normalized;
	}

	private static String extensionFor(String contentType, String filename) {
		String normalized = normalize(contentType);
		return switch (normalized) {
			case "application/pdf" -> "pdf";
			case "application/msword" -> "doc";
			case "application/vnd.openxmlformats-officedocument.wordprocessingml.document" -> "docx";
			case "text/plain" -> "txt";
			default -> {
				if (filename != null) {
					String lower = filename.toLowerCase(Locale.ROOT);
					if (lower.endsWith(".pdf")) yield "pdf";
					if (lower.endsWith(".doc")) yield "doc";
					if (lower.endsWith(".docx")) yield "docx";
					if (lower.endsWith(".txt")) yield "txt";
				}
				yield "bin";
			}
		};
	}

	private static String safeName(String original) {
		if (original == null || original.isBlank()) return "document.pdf";
		String trimmed = original.trim().replace('\\', '/');
		int slash = trimmed.lastIndexOf('/');
		String base = slash >= 0 ? trimmed.substring(slash + 1) : trimmed;
		return base.length() > 255 ? base.substring(base.length() - 255) : base;
	}
}
