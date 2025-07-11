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

    // ------------------------------------------
    // PRIMARY KEY
    // ------------------------------------------
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ------------------------------------------
    // BASIC FIELDS
    // ------------------------------------------
    @Column(nullable = false)
    private String title;

    @Column(length = 500)
    private String description;

    @Column(nullable = false)
    private boolean completed;

    // ------------------------------------------
    // RELATIONSHIPS
    // ------------------------------------------
    /** The list/column this task belongs to. */
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "list_id", nullable = false)
    private TaskList list;

    // ------------------------------------------
    // TIMESTAMPS
    // ------------------------------------------
    /** Task creation datetime, set automatically on persist. */
    @Column(nullable = false, updatable = false)
    private LocalDateTime creationDate;

    /** Optional due date. */
    @Column(nullable = true)
    private LocalDate dueDate;

    // ------------------------------------------
    // ATTACHMENTS
    // ------------------------------------------
    /** List of attachment filenames associated with this task. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "task_attachments", joinColumns = @JoinColumn(name = "task_id"))
    @Column(name = "filename")
    private List<String> attachments = new ArrayList<>();

    // ------------------------------------------
    // CONSTRUCTORS
    // ------------------------------------------
    public Task() {}

    public Task(String title, String description, boolean completed, TaskList list) {
        this.title = title;
        this.description = description;
        this.completed = completed;
        this.list = list;
    }

    // ------------------------------------------
    // GETTERS & SETTERS
    // ------------------------------------------
    public Long getId() { return id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public boolean isCompleted() { return completed; }
    public void setCompleted(boolean completed) { this.completed = completed; }

    public TaskList getList() { return list; }
    public void setList(TaskList list) { this.list = list; }

    public LocalDateTime getCreationDate() { return creationDate; }

    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }

    public List<String> getAttachments() {
        if (attachments == null) attachments = new ArrayList<>();
        return attachments;
    }
    public void setAttachments(List<String> attachments) { this.attachments = attachments; }

    // ------------------------------------------
    // LIFECYCLE HOOKS
    // ------------------------------------------
    /** Automatically set creationDate when the entity is persisted. */
    @PrePersist
    protected void onCreate() {
        this.creationDate = LocalDateTime.now();
    }
}
