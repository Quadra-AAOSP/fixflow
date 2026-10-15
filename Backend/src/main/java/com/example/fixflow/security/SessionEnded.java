package com.example.fixflow.security;

/** Locally revokes socket connections when HTTP logout invalidates their session. */
public record SessionEnded(String sessionId) { }
