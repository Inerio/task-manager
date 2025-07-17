package com.inerio.taskmanager.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Data Transfer Object for Task.
 * <p>
 * Used for exchanging Task data between frontend (Angular) and backend (Spring Boot) via the API.
 * Contains all fields relevant for Kanban board display and logic.
 * </p>
 *
 * <ul>
 *   <li>Immutable ID (nullable on create, filled on update/fetch)</li>
 *   <li>Column position management for drag &amp; drop (position)</li>
 *   <li>Reference to parent list/column by ID (listId)</li>
 *   <li>Attachment filenames for file upload/download</li>
 *   <li>Timestamps for auditing/UX</li>
 * </ul>
 *
 * <p>
 * This class is pure DTO: no business logic, only data structure.
 * </p>
 */
public class TaskDto {

    /**
     * Task unique identifier.
     * <p>
     * May be null for creation requests.
     * </p>
     */
    private Long id;

    /**
     * Title of the task (required, not blank).
     */
    private String title;

    /**
     * Optional description for the task.
     */
    private String description;

    /**
     * Completion status (true if completed).
     */
    private boolean completed;

    /**
     * ID of the parent TaskList (Kanban column).
     * <p>
     * Required for all create/update requests.
     * </p>
     */
    private Long listId;

    /**
     * Persistent index/position of this task in its list (for drag &amp; drop).
     * <p>
     * Lower values are higher in the list.
     * </p>
     */
    private int position;

    /**
     * Timestamp for when the task was created (set by backend).
     */
    private LocalDateTime creationDate;

    /**
     * Optional due date for the task.
     */
    private LocalDate dueDate;

    /**
     * List of filenames for attachments (uploaded files).
     */
    private List<String> attachments;

    // ===========================
    //   GETTERS & SETTERS
    // ===========================

    /**
     * Gets the task ID.
     * @return the task ID, or null if not yet persisted
     */
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    /**
     * Gets the task title.
     * @return the title (never null)
     */
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    /**
     * Gets the task description.
     * @return the description (nullable)
     */
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    /**
     * Gets the completion status.
     * @return true if the task is completed
     */
    public boolean isCompleted() { return completed; }
    public void setCompleted(boolean completed) { this.completed = completed; }

    /**
     * Gets the parent list ID.
     * @return the TaskList (column) ID
     */
    public Long getListId() { return listId; }
    public void setListId(Long listId) { this.listId = listId; }

    /**
     * Gets the position of the task in its list.
     * @return the position (index)
     */
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }

    /**
     * Gets the creation timestamp.
     * @return the creation date/time
     */
    public LocalDateTime getCreationDate() { return creationDate; }
    public void setCreationDate(LocalDateTime creationDate) { this.creationDate = creationDate; }

    /**
     * Gets the optional due date.
     * @return the due date, or null if not set
     */
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }

    /**
     * Gets the list of attachment filenames.
     * @return list of filenames, can be empty but never null
     */
    public List<String> getAttachments() { return attachments; }
    public void setAttachments(List<String> attachments) { this.attachments = attachments; }
}
