package com.example.fixflow.ai;

import java.util.List;

/**
 * Interface for AI providers that answer a stateless chat conversation.
 * The caller always supplies the full message history (system message
 * first); the provider returns only the assistant's next reply. This
 * abstraction keeps all model access server-side and swappable without
 * touching the controller or business logic.
 */
public interface ChatProvider {

    /**
     * Sends the conversation to the model and returns the assistant reply text.
     *
     * @param messages ordered conversation turns; the first message must have the "system" role
     * @return the assistant's reply content
     * @throws AIProviderException if the provider call fails (API errors, timeouts, rate limits)
     */
    String chat(List<ChatMessage> messages) throws AIProviderException;

    /**
     * Gets the provider name for logging and monitoring purposes.
     *
     * @return The provider name (e.g., "OpenRouter")
     */
    String getProviderName();
}
