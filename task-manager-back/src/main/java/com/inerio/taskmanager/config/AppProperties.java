package com.inerio.taskmanager.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Application-level properties bound from {@code application.properties} (or YAML)
 * under the {@code app} prefix. Provides strongly-typed access to custom settings.
 */
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    /**
     * Number of days of inactivity after which an anonymous user and all of its data
     * can be purged by the scheduled cleanup job. Default is {@code 90}.
     */
    private int retentionDays = 90;

    /**
     * Base directory on disk where task attachments are stored.
     * Default is {@code "uploads"}.
     */
    private String uploadDir = "uploads";

    /**
     * Returns the inactivity retention window in days.
     *
     * @return the number of days before inactive data may be purged
     */
    public int getRetentionDays() {
        return retentionDays;
    }

    /**
     * Sets the inactivity retention window in days.
     *
     * @param retentionDays the number of days before inactive data may be purged
     */
    public void setRetentionDays(int retentionDays) {
        this.retentionDays = retentionDays;
    }

    /**
     * Returns the base directory used to store task attachments.
     *
     * @return the upload directory path
     */
    public String getUploadDir() {
        return uploadDir;
    }

    /**
     * Sets the base directory used to store task attachments.
     *
     * @param uploadDir the upload directory path
     */
    public void setUploadDir(String uploadDir) {
        this.uploadDir = uploadDir;
    }
}
