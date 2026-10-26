package com.example.fixflow.security;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Real session-bound token exchange for HTTP tests, including manual Secure-cookie tests. */
public final class CsrfHttp {
    private CsrfHttp() { }

    public static HttpRequest.Builder authorize(HttpClient client, HttpRequest.Builder write, URI origin,
            String cookie) throws Exception {
        var request = HttpRequest.newBuilder(origin.resolve("/api/auth/csrf")).GET();
        if (cookie != null) request.header("Cookie", cookie);
        var response = client.send(request.build(), HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) throw new IllegalStateException("Cannot fetch CSRF token");
        var token = new ObjectMapper().readTree(response.body());
        write.header(token.path("headerName").asText(), token.path("token").asText());
        if (cookie != null) {
            write.header("Cookie", cookie);
        } else if (client.cookieHandler().isEmpty()) {
            response.headers().allValues("set-cookie").stream().filter(c -> c.startsWith("SESSION="))
                    .findFirst().ifPresent(c -> write.header("Cookie", c.split(";", 2)[0]));
        }
        return write;
    }
}
