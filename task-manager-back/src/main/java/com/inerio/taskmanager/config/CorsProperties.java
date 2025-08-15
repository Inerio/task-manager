package com.inerio.taskmanager.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Strongly-typed binding for {@code app.cors.*} properties.
 * Comma-separated values in properties/yaml are split into lists.
 */
@ConfigurationProperties(prefix = "app.cors")
public class CorsProperties {

    /**
     * Allowed origins for CORS.
     */
    private List<String> allowedOrigins = List.of("http://localhost:4200");

    /**
     * Allowed HTTP methods for CORS.
     */
    private List<String> allowedMethods = List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS");

    /**
     * Allowed HTTP headers for CORS. Use "*" to allow all.
     */
    private List<String> allowedHeaders = List.of("*");

    public List<String> getAllowedOrigins() {
        return allowedOrigins;
    }

    public void setAllowedOrigins(List<String> allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }

    public List<String> getAllowedMethods() {
        return allowedMethods;
    }

    public void setAllowedMethods(List<String> allowedMethods) {
        this.allowedMethods = allowedMethods;
    }

    public List<String> getAllowedHeaders() {
        return allowedHeaders;
    }

    public void setAllowedHeaders(List<String> allowedHeaders) {
        this.allowedHeaders = allowedHeaders;
    }
}
