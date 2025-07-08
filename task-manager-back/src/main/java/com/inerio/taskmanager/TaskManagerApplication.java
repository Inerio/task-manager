package com.inerio.taskmanager;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Main entry point for the Spring Boot application.
 * Enables global CORS configuration for Angular frontend.
 */
@SpringBootApplication
public class TaskManagerApplication {

    public static void main(String[] args) {
        SpringApplication.run(TaskManagerApplication.class, args);
    }

    /**
     * Allows CORS requests from Angular frontend (http://localhost:4200).
     * Adapt origins for production!
     */
    @Bean
    WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**")
                    .allowedOrigins("http://localhost:4200")
                    .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                    .allowedHeaders("*");
            }
        };
    }
}
