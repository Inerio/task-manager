package com.inerio.taskmanager.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Global CORS configuration backed by {@link CorsProperties}.
 */
@Configuration
@EnableConfigurationProperties(CorsProperties.class)
public class WebCorsConfig {

    private final CorsProperties cors;

    public WebCorsConfig(CorsProperties cors) {
        this.cors = cors;
    }

    @Bean
    WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(@NonNull CorsRegistry registry) {
                registry.addMapping("/**")
                        .allowedOrigins(cors.getAllowedOrigins().toArray(String[]::new))
                        .allowedMethods(cors.getAllowedMethods().toArray(String[]::new))
                        .allowedHeaders(cors.getAllowedHeaders().toArray(String[]::new));
            }
        };
    }
}
