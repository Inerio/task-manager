package com.inerio.taskmanager.dto;

/**
 * Data Transfer Object (DTO) for moving a task (drag &amp; drop) between columns.
 * <p>
 * Used as the request body for the <b>POST</b> <code>/api/v1/tasks/move</code> endpoint.
 * </p>
 *
 * <ul>
 *     <li><b>taskId</b> — The ID of the task to move.</li>
 *     <li><b>targetKanbanColumnId</b> — The ID of the target column.</li>
 *     <li><b>targetPosition</b> — The 0-based index to place the task at in the new column.</li>
 * </ul>
 *
 * <p>
 * This class is a pure DTO: no business logic, only simple field structure for API requests.
 * </p>
 */
public class TaskMoveDto {

    /**
     * The ID of the task to move.
     * <p>
     * Must be provided by the frontend.
     * </p>
     */
    private Long taskId;

    /**
     * The ID of the target column where the task should be moved.
     * <p>
     * Must be provided by the frontend.
     * </p>
     */
    private Long targetKanbanColumnId;

    /**
     * The index (0-based) in the target column where the task should be placed.
     */
    private int targetPosition;

    // ==========================
    //   CONSTRUCTORS
    // ==========================

    /**
     * Default constructor for serialization/deserialization.
     * <p>
     * Required by frameworks like Jackson.
     * </p>
     */
    public TaskMoveDto() {}

    /**
     * Full constructor for TaskMoveDto.
     *
     * @param taskId        The task ID
     * @param targetKanbanColumnId  The target column ID
     * @param targetPosition The index in the target column
     */
    public TaskMoveDto(Long taskId, Long targetKanbanColumnId, int targetPosition) {
        this.taskId = taskId;
        this.targetKanbanColumnId = targetKanbanColumnId;
        this.targetPosition = targetPosition;
    }

    // ==========================
    //   GETTERS & SETTERS
    // ==========================

    /**
     * Gets the task ID.
     * @return the taskId (never null for a valid request)
     */
    public Long getTaskId() {
        return taskId;
    }

    /**
     * Sets the task ID.
     * @param taskId The ID of the task to move
     */
    public void setTaskId(Long taskId) {
        this.taskId = taskId;
    }

    /**
     * Gets the target column ID.
     * @return the target column ID (never null for a valid request)
     */
    public Long getTargetKanbanColumnId() {
        return targetKanbanColumnId;
    }

    /**
     * Sets the target column ID.
     * @param targetKanbanColumnId The ID of the target column
     */
    public void setTargetKanbanColumnId(Long targetKanbanColumnId) {
        this.targetKanbanColumnId = targetKanbanColumnId;
    }

    /**
     * Gets the target position (index in the column).
     * @return the 0-based index where the task should be placed
     */
    public int getTargetPosition() {
        return targetPosition;
    }

    /**
     * Sets the target position (index in the column).
     * @param targetPosition the index to place the task at
     */
    public void setTargetPosition(int targetPosition) {
        this.targetPosition = targetPosition;
    }
}
