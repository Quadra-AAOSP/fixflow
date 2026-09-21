package com.example.fixflow.ai;

import lombok.Getter;

/**
 * Exception thrown when AI provider operations fail.
 * This includes API errors, timeouts, rate limits, and invalid responses.
 */
@Getter
public class AIProviderException extends Exception {

    private final AIErrorType errorType;

    public AIProviderException(String message, AIErrorType errorType) {
        super(message);
        this.errorType = errorType;
    }

    public AIProviderException(String message, Throwable cause, AIErrorType errorType) {
        super(message, cause);
        this.errorType = errorType;
    }

    /**
     * Types of AI provider errors for handling different failure scenarios.
     */
    public enum AIErrorType {
        API_ERROR,
        TIMEOUT,
        RATE_LIMIT,
        INVALID_RESPONSE,
        AUTHENTICATION_ERROR,
        NETWORK_ERROR,
        UNKNOWN_ERROR
    }
}