package com.example.fixflow.ai.openrouter;

import java.util.regex.Pattern;

/** Accepts a JSON payload with an optional single Markdown code fence. */
public final class ModelJson {
    private static final Pattern JSON_FENCE = Pattern.compile(
            "\\A```(?:json)?\\s*([\\s\\S]*?)\\s*```\\z", Pattern.CASE_INSENSITIVE);

    private ModelJson() { }

    public static String unwrap(String content) {
        if (content == null) {
            return null;
        }
        String trimmed = content.strip();
        var fenced = JSON_FENCE.matcher(trimmed);
        return fenced.matches() ? fenced.group(1) : trimmed;
    }
}
