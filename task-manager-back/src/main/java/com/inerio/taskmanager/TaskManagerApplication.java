package com.inerio.taskmanager;

import com.inerio.taskmanager.config.AppProperties;
import com.inerio.taskmanager.config.CorsProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Spring Boot entry point for the Task Manager application.
 * Enables scheduling and binds {@code app.*} properties.
 */
@EnableScheduling
@EnableConfigurationProperties({AppProperties.class, CorsProperties.class})
@SpringBootApplication
public class TaskManagerApplication {

    /** Default constructor (required by Spring). */
    public TaskManagerApplication() { }

    /**
     * Application entry point.
     *
     * @param args command-line arguments
     */
    public static void main(String[] args) {
        SpringApplication.run(TaskManagerApplication.class, args);
    }
}
