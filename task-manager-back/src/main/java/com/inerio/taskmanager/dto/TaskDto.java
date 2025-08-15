package com.inerio.taskmanager.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO representing a Task used in API requests and responses.
 * Carries core fields for Kanban display, editing, and attachment handling.
 */
public class TaskDto {

    /** Unique identifier; may be {@code null} on creation. */
    private Long id;

    /** Task title. */
    private String title;

    /** Optional task description. */
    private String description;

    /** Completion flag. */
    private boolean completed;

    /** ID of the parent Kanban column. */
    private Long kanbanColumnId;

    /** Zero-based position within the column. */
    private int position;

    /** Creation timestamp (set by the backend). */
    private LocalDateTime creationDate;

    /** Optional due date. */
    private LocalDate dueDate;

    /** Attachment filenames associated with the task. */
    private List<String> attachments;

    /** Default constructor required for serialization frameworks. */
    public TaskDto() {
    }

    /**
     * Returns the task ID.
     *
     * @return task ID, or {@code null} if not yet persisted
     */
    public Long getId() {
        return id;
    }

    /**
     * Sets the task ID.
     *
     * @param id unique identifier; may be {@code null} on creation
     */
    public void setId(Long id) {
        this.id = id;
    }

    /**
     * Returns the task title.
     *
     * @return title
     */
    public String getTitle() {
        return title;
    }

    /**
     * Sets the task title.
     *
     * @param title task title
     */
    public void setTitle(String title) {
        this.title = title;
    }

    /**
     * Returns the task description.
     *
     * @return description, or {@code null} if not set
     */
    public String getDescription() {
        return description;
    }

    /**
     * Sets the task description.
     *
     * @param description task description (nullable)
     */
    public void setDescription(String description) {
        this.description = description;
    }

    /**
     * Indicates whether the task is completed.
     *
     * @return {@code true} if completed; otherwise {@code false}
     */
    public boolean isCompleted() {
        return completed;
    }

    /**
     * Sets the completion flag.
     *
     * @param completed {@code true} if completed; otherwise {@code false}
     */
    public void setCompleted(boolean completed) {
        this.completed = completed;
    }

    /**
     * Returns the parent column ID.
     *
     * @return Kanban column ID
     */
    public Long getKanbanColumnId() {
        return kanbanColumnId;
    }

    /**
     * Sets the parent column ID.
     *
     * @param kanbanColumnId ID of the parent Kanban column
     */
    public void setKanbanColumnId(Long kanbanColumnId) {
        this.kanbanColumnId = kanbanColumnId;
    }

    /**
     * Returns the task position within its column.
     *
     * @return zero-based position
     */
    public int getPosition() {
        return position;
    }

    /**
     * Sets the task position within its column.
     *
     * @param position zero-based position
     */
    public void setPosition(int position) {
        this.position = position;
    }

    /**
     * Returns the creation timestamp.
     *
     * @return creation date/time
     */
    public LocalDateTime getCreationDate() {
        return creationDate;
    }

    /**
     * Sets the creation timestamp.
     *
     * @param creationDate creation date/time (backend-managed)
     */
    public void setCreationDate(LocalDateTime creationDate) {
        this.creationDate = creationDate;
    }

    /**
     * Returns the due date.
     *
     * @return due date, or {@code null} if not set
     */
    public LocalDate getDueDate() {
        return dueDate;
    }

    /**
     * Sets the due date.
     *
     * @param dueDate due date (nullable)
     */
    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    /**
     * Returns attachment filenames.
     *
     * @return list of filenames; may be empty
     */
    public List<String> getAttachments() {
        return attachments;
    }

    /**
     * Sets attachment filenames.
     *
     * @param attachments list of filenames
     */
    public void setAttachments(List<String> attachments) {
        this.attachments = attachments;
    }
}
