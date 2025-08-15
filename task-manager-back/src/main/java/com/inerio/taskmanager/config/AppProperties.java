package com.inerio.taskmanager.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Application-level properties bound from {@code application.properties} (or YAML)
 * under the {@code app} prefix. Provides strongly-typed access to custom settings.
 */
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    /** Number of days of inactivity after which an anonymous user may be purged. */
    private int retentionDays = 90;

    /** Base directory on disk where task attachments are stored. */
    private String uploadDir = "uploads";

    /** Comma-separated list of allowed CORS origins. */
    private String corsAllowedOrigins = "http://localhost:4200";

    /** Comma-separated list of allowed CORS methods. */
    private String corsAllowedMethods = "GET,POST,PUT,PATCH,DELETE,OPTIONS";

    /** Comma-separated list of allowed CORS headers. */
    private String corsAllowedHeaders = "*";

    // ----- getters / setters -----

    public int getRetentionDays() { return retentionDays; }
    public void setRetentionDays(int retentionDays) { this.retentionDays = retentionDays; }

    public String getUploadDir() { return uploadDir; }
    public void setUploadDir(String uploadDir) { this.uploadDir = uploadDir; }

    public String getCorsAllowedOrigins() { return corsAllowedOrigins; }
    public void setCorsAllowedOrigins(String corsAllowedOrigins) { this.corsAllowedOrigins = corsAllowedOrigins; }

    public String getCorsAllowedMethods() { return corsAllowedMethods; }
    public void setCorsAllowedMethods(String corsAllowedMethods) { this.corsAllowedMethods = corsAllowedMethods; }

    public String getCorsAllowedHeaders() { return corsAllowedHeaders; }
    public void setCorsAllowedHeaders(String corsAllowedHeaders) { this.corsAllowedHeaders = corsAllowedHeaders; }
}
