package com.inerio.taskmanager;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Main class and entry point for the TaskManager Spring Boot application.
 * <p>
 * This class configures global CORS settings to allow the Angular frontend
 * (typically running on http://localhost:4200) to communicate with the backend.
 * </p>
 * <p>
 * <b>PRODUCTION WARNING:</b> Do not use wildcard origins or broad CORS rules in production!
 * Adapt the allowed origins before deployment for security.
 * </p>
 */
@SpringBootApplication
public class TaskManagerApplication {

    /**
     * Default constructor.
     * <p>
     * Required by Spring Boot.
     * </p>
     */
    public TaskManagerApplication() {
        // No initialization required.
    }

    /**
     * Application entry point.
     *
     * @param args command-line arguments (unused)
     */
    public static void main(String[] args) {
        SpringApplication.run(TaskManagerApplication.class, args);
    }

    /**
     * Configures global CORS policy for all endpoints.
     * Allows requests from the Angular development server.
     * 
     * @return the CORS configuration bean
     */
    @Bean
    WebMvcConfigurer corsConfigurer() {
        // Anonymous inner class implementing WebMvcConfigurer
        return new WebMvcConfigurer() {
            /**
             * Add mappings to allow CORS requests for all endpoints.
             * Adjust allowed origins in production!
             *
             * @param registry the CORS registry to configure
             */
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**")
                    .allowedOrigins("http://localhost:4200") // Update for prod!
                    .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                    .allowedHeaders("*");
            }
        };
    }
}
