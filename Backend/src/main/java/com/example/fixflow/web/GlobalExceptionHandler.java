package com.example.fixflow.web;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import jakarta.servlet.http.HttpServletRequest;

@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(org.springframework.web.HttpMediaTypeNotSupportedException.class)
	public ResponseEntity<ApiError> handleUnsupportedMedia(Exception ex, HttpServletRequest request) {
		return ResponseEntity.status(415).body(ApiError.of(
				415,
				"Unsupported Media Type",
				"Use application/json or multipart/form-data for report creation",
				request.getRequestURI()));
	}

	@ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
	public ResponseEntity<ApiError> handleUploadTooLarge(Exception ex, HttpServletRequest request) {
		return ResponseEntity.status(422).body(ApiError.of(
				422,
				"Unprocessable Entity",
				"Each photo must be at most 5 MiB",
				request.getRequestURI()));
	}

	@ExceptionHandler(org.springframework.web.bind.MissingServletRequestParameterException.class)
	public ResponseEntity<ApiError> handleMissingParam(Exception ex, HttpServletRequest request) {
		return ResponseEntity.badRequest().body(ApiError.of(
				400, "Bad Request", "Missing required request parameter", request.getRequestURI()));
	}

	@ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
	public ResponseEntity<ApiError> handleConflict(Exception ex, HttpServletRequest request) {
		return ResponseEntity.status(409).body(ApiError.of(
				409, "Conflict", "Conflicting or duplicate data", request.getRequestURI()));
	}

	@ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
	public ResponseEntity<ApiError> handleInvalidParameter(Exception ex, HttpServletRequest request) {
		return ResponseEntity.badRequest().body(ApiError.of(
				400, "Bad Request", "Invalid request parameter", request.getRequestURI()));
	}

	@ExceptionHandler(ApiException.class)
	public ResponseEntity<ApiError> handleApiException(ApiException ex, HttpServletRequest request) {
		HttpStatus status = HttpStatus.valueOf(ex.getStatus());
		return ResponseEntity.status(status).body(
				ApiError.of(status.value(), status.getReasonPhrase(), ex.getMessage(), request.getRequestURI())
		);
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
		List<ApiError.FieldErrorDetail> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
				.map(this::toFieldError)
				.toList();
		String message = fieldErrors.stream()
				.map(ApiError.FieldErrorDetail::message)
				.collect(Collectors.joining("; "));
		return ResponseEntity.badRequest().body(ApiError.validation(message, request.getRequestURI(), fieldErrors));
	}

	@ExceptionHandler(HttpMessageNotReadableException.class)
	public ResponseEntity<ApiError> handleUnreadable(HttpMessageNotReadableException ex, HttpServletRequest request) {
		return ResponseEntity.badRequest().body(
				ApiError.of(400, "Bad Request", "Invalid request body", request.getRequestURI())
		);
	}

	@ExceptionHandler(BadCredentialsException.class)
	public ResponseEntity<ApiError> handleBadCredentials(BadCredentialsException ex, HttpServletRequest request) {
		return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
				ApiError.of(401, "Unauthorized", "Invalid email or password", request.getRequestURI())
		);
	}

	@ExceptionHandler(AuthorizationDeniedException.class)
	public ResponseEntity<ApiError> handleDenied(AuthorizationDeniedException ex, HttpServletRequest request) {
		return ResponseEntity.status(HttpStatus.FORBIDDEN).body(
				ApiError.of(403, "Forbidden", "Access denied", request.getRequestURI())
		);
	}

	private ApiError.FieldErrorDetail toFieldError(FieldError error) {
		String message = error.getDefaultMessage() == null ? "Invalid value" : error.getDefaultMessage();
		return new ApiError.FieldErrorDetail(error.getField(), message);
	}
}
