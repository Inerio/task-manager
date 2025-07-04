package com.inerio.taskmanager.model;

import java.time.LocalDate;
import java.time.LocalDateTime;

import jakarta.persistence.*;

@Entity
public class Task {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(length = 500)
    private String description;

    @Column(nullable = false)
    private boolean completed;

    @Column(nullable = false)
    private String status; // à remplacer par TaskStatus enum

    @Column(nullable = false, updatable = false)
    private LocalDateTime creationDate;

    @Column(nullable = true)
    private LocalDate dueDate;
    
    // Constructeurs
    public Task() {}

    public Task(String title, String description, boolean completed, String status) {
        this.title = title;
        this.description = description;
        this.completed = completed;
        this.status = status;
    }

    // Getters / Setters
    public Long getId() { return id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public boolean isCompleted() { return completed; }
    public void setCompleted(boolean completed) { this.completed = completed; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    
    public LocalDateTime getCreationDate() { return creationDate; }
    
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    
    @PrePersist
    protected void onCreate() {
        this.creationDate = LocalDateTime.now();
    }
}
