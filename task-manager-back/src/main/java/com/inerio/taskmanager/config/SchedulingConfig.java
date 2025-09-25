package com.inerio.taskmanager.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Enable @Scheduled tasks (used for SSE heartbeats). */
@Configuration
@EnableScheduling
public class SchedulingConfig { }
