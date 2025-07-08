package com.inerio.taskmanager.model;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.*;

/**
 * Entity representing a Task in the application.
 */
@Entity
public class Task {

    /**
     * Unique identifier for the task (auto-generated).
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Title of the task (required).
     */
    @Column(nullable = false)
    private String title;

    /**
     * Optional description, limited to 500 characters.
     */
    @Column(length = 500)
    private String description;

    /**
     * Completion status.
     */
    @Column(nullable = false)
    private boolean completed;

    /**
     * Status/column of the task (e.g., 'todo', 'in-progress', 'done').
     */
    @Column(nullable = false)
    private String status; // TODO: Replace with TaskStatus enum

    /**
     * Date/time when the task was created.
     */
    @Column(nullable = false, updatable = false)
    private LocalDateTime creationDate;

    /**
     * Optional due date.
     */
    @Column(nullable = true)
    private LocalDate dueDate;

    /**
     * List of attachment filenames (stored in /uploads).
     */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "task_attachments", joinColumns = @JoinColumn(name = "task_id"))
    @Column(name = "filename")
    private List<String> attachments = new ArrayList<>();

    // --- Constructors ---

    public Task() {}

    public Task(String title, String description, boolean completed, String status) {
        this.title = title;
        this.description = description;
        this.completed = completed;
        this.status = status;
    }

    // --- Getters / Setters ---

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

    public List<String> getAttachments() {
        // Always return a non-null list
        if (attachments == null) attachments = new ArrayList<>();
        return attachments;
    }
    public void setAttachments(List<String> attachments) { this.attachments = attachments; }

    /**
     * Automatically sets the creation date before persisting.
     */
    @PrePersist
    protected void onCreate() {
        this.creationDate = LocalDateTime.now();
    }
}
