package com.example.fixflow.web;

import java.io.IOException;
import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TraceIdFilter extends OncePerRequestFilter {

	public static final String HEADER = "X-Trace-Id";
	public static final String MDC_KEY = "traceId";

	private static final ThreadLocal<String> CURRENT = new ThreadLocal<>();

	public static String currentTraceId() {
		String value = CURRENT.get();
		if (value != null) {
			return value;
		}
		return MDC.get(MDC_KEY);
	}

	@Override
	protected void doFilterInternal(
			HttpServletRequest request,
			HttpServletResponse response,
			FilterChain filterChain
	) throws ServletException, IOException {
		String incoming = request.getHeader(HEADER);
		String traceId = (incoming == null || incoming.isBlank())
				? UUID.randomUUID().toString()
				: incoming.trim();
		CURRENT.set(traceId);
		MDC.put(MDC_KEY, traceId);
		response.setHeader(HEADER, traceId);
		try {
			filterChain.doFilter(request, response);
		} finally {
			CURRENT.remove();
			MDC.remove(MDC_KEY);
		}
	}
}
