package com.inerio.taskmanager;

import com.inerio.taskmanager.config.AppProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.lang.NonNull;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Spring Boot entry point for the Task Manager application.
 * Enables scheduling, binds {@code app.*} properties, and configures global CORS.
 */
@EnableScheduling
@EnableConfigurationProperties(AppProperties.class)
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

    /**
     * Defines a global CORS policy allowing requests from the Angular development server.
     * Adjust allowed origins for production deployments.
     *
     * @return MVC configuration bean with CORS mappings
     */
    @Bean
    WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(@NonNull CorsRegistry registry) {
                registry.addMapping("/**")
                        .allowedOrigins("http://localhost:4200")
                        .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                        .allowedHeaders("*");
            }
        };
    }
}
