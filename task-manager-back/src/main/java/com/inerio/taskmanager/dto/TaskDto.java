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
 *   <li>Reference to parent column by ID (kanbanColumnId)</li>
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
	 * Default constructor.
	 * <p>
	 * Required for frameworks and serialization.
	 * </p>
	 */
	public TaskDto() {}
	
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
     * ID of the parent KanbanColumn (Kanban column).
     * <p>
     * Required for all create/update requests.
     * </p>
     */
    private Long kanbanColumnId;

    /**
     * Persistent index/position of this task in its column (for drag &amp; drop).
     * <p>
     * Lower values are higher in the column.
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

    /**
     * Sets the task ID.
     * @param id the unique identifier, can be null for new tasks
     */
    public void setId(Long id) { this.id = id; }

    /**
     * Gets the task title.
     * @return the title (never null)
     */
    public String getTitle() { return title; }

    /**
     * Sets the task title.
     * @param title the new task title (must not be null)
     */
    public void setTitle(String title) { this.title = title; }

    /**
     * Gets the task description.
     * @return the description (nullable)
     */
    public String getDescription() { return description; }

    /**
     * Sets the task description.
     * @param description the new description (optional)
     */
    public void setDescription(String description) { this.description = description; }

    /**
     * Gets the completion status.
     * @return true if the task is completed
     */
    public boolean isCompleted() { return completed; }

    /**
     * Sets the completion status.
     * @param completed true if the task is completed, false otherwise
     */
    public void setCompleted(boolean completed) { this.completed = completed; }

    /**
     * Gets the parent column ID.
     * @return the KanbanColumn (column) ID
     */
    public Long getKanbanColumnId() { return kanbanColumnId; }

    /**
     * Sets the parent column ID.
     * @param kanbanColumnId the ID of the parent KanbanColumn (column)
     */
    public void setKanbanColumnId(Long kanbanColumnId) { this.kanbanColumnId = kanbanColumnId; }

    /**
     * Gets the position of the task in its column.
     * @return the position (index)
     */
    public int getPosition() { return position; }

    /**
     * Sets the position of the task in its column.
     * @param position the index/position for drag &amp; drop
     */
    public void setPosition(int position) { this.position = position; }

    /**
     * Gets the creation timestamp.
     * @return the creation date/time
     */
    public LocalDateTime getCreationDate() { return creationDate; }

    /**
     * Sets the creation timestamp.
     * @param creationDate the creation date/time (set by backend)
     */
    public void setCreationDate(LocalDateTime creationDate) { this.creationDate = creationDate; }

    /**
     * Gets the optional due date.
     * @return the due date, or null if not set
     */
    public LocalDate getDueDate() { return dueDate; }

    /**
     * Sets the optional due date.
     * @param dueDate the due date (nullable)
     */
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }

    /**
     * Gets the list of attachment filenames.
     * @return list of filenames, can be empty but never null
     */
    public List<String> getAttachments() { return attachments; }

    /**
     * Sets the list of attachment filenames.
     * @param attachments list of filenames for uploaded files
     */
    public void setAttachments(List<String> attachments) { this.attachments = attachments; }

}
