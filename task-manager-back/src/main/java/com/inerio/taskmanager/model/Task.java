package com.inerio.taskmanager.model;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Kanban task entity.
 * Belongs to a {@link KanbanColumn}, supports ordering within the column,
 * timestamps, and optional file attachments.
 */

@Table(
	    name = "task",
	    uniqueConstraints = @UniqueConstraint(columnNames = {"kanbanColumn_id", "position"})
	)
@Entity
public class Task {

    /** Database-generated identifier. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Task title. */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String title;

    /** Task description. */
    @Column(columnDefinition = "TEXT")
    private String description;

    /** Completion flag. */
    @Column(nullable = false)
    private boolean completed;

    /** Zero-based position within the column (0 = top). */
    @Column(nullable = false)
    private int position = 0;

    /** Parent column (required). */
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "kanbanColumn_id", nullable = false)
    private KanbanColumn kanbanColumn;

    /** Creation timestamp (set once on persist). */
    @Column(nullable = false, updatable = false)
    private LocalDateTime creationDate;

    /** Optional due date. */
    @Column
    private LocalDate dueDate;

    /** Attachment filenames stored for this task. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "task_attachments", joinColumns = @JoinColumn(name = "task_id"))
    @Column(name = "filename")
    private List<String> attachments = new ArrayList<>();

    /** Default constructor for JPA. */
    public Task() { }

    /**
     * Constructs a task with the main fields.
     *
     * @param title        task title
     * @param description  task description
     * @param completed    completion flag
     * @param kanbanColumn parent column
     */
    public Task(String title, String description, boolean completed, KanbanColumn kanbanColumn) {
        this.title = title;
        this.description = description;
        this.completed = completed;
        this.kanbanColumn = kanbanColumn;
    }

    /** @return task id */
    public Long getId() {
        return id;
    }

    /** @return title */
    public String getTitle() {
        return title;
    }

    /** @param title new title */
    public void setTitle(String title) {
        this.title = title;
    }

    /** @return description (nullable) */
    public String getDescription() {
        return description;
    }

    /** @param description new description */
    public void setDescription(String description) {
        this.description = description;
    }

    /** @return {@code true} if completed */
    public boolean isCompleted() {
        return completed;
    }

    /** @param completed completion flag */
    public void setCompleted(boolean completed) {
        this.completed = completed;
    }

    /** @return zero-based position */
    public int getPosition() {
        return position;
    }

    /** @param position zero-based position */
    public void setPosition(int position) {
        this.position = position;
    }

    /** @return parent column */
    public KanbanColumn getKanbanColumn() {
        return kanbanColumn;
    }

    /** @param kanbanColumn parent column */
    public void setKanbanColumn(KanbanColumn kanbanColumn) {
        this.kanbanColumn = kanbanColumn;
    }

    /** @return creation timestamp */
    public LocalDateTime getCreationDate() {
        return creationDate;
    }

    /** @return due date (nullable) */
    public LocalDate getDueDate() {
        return dueDate;
    }

    /** @param dueDate due date (nullable) */
    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    /**
     * Returns the attachment filenames. Never {@code null}; for legacy data
     * an empty list is returned if needed.
     *
     * @return list of attachment filenames
     */
    public List<String> getAttachments() {
        if (attachments == null) {
            attachments = new ArrayList<>();
        }
        return attachments;
    }

    /** @param attachments list of attachment filenames */
    public void setAttachments(List<String> attachments) {
        this.attachments = attachments;
    }

    /**
     * Initializes the creation timestamp before first persist.
     */
    @PrePersist
    protected void onCreate() {
        this.creationDate = LocalDateTime.now();
    }
}
