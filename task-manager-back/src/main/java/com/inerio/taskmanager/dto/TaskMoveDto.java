package com.inerio.taskmanager.dto;

/**
 * DTO used to move a task (drag and drop) between columns.
 * <p>
 * Consumed by the <b>POST</b> {@code /api/v1/tasks/move} endpoint.
 * </p>
 */
public class TaskMoveDto {

    /** ID of the task to move. */
    private Long taskId;

    /** ID of the target column. */
    private Long targetKanbanColumnId;

    /** Zero-based index within the target column. */
    private int targetPosition;

    /** Default constructor for serialization frameworks. */
    public TaskMoveDto() { }

    /**
     * Creates a new {@code TaskMoveDto}.
     *
     * @param taskId               the task ID
     * @param targetKanbanColumnId the target column ID
     * @param targetPosition       the zero-based index in the target column
     */
    public TaskMoveDto(Long taskId, Long targetKanbanColumnId, int targetPosition) {
        this.taskId = taskId;
        this.targetKanbanColumnId = targetKanbanColumnId;
        this.targetPosition = targetPosition;
    }

    /** @return the task ID */
    public Long getTaskId() {
        return taskId;
    }

    /** @param taskId the task ID to set */
    public void setTaskId(Long taskId) {
        this.taskId = taskId;
    }

    /** @return the target column ID */
    public Long getTargetKanbanColumnId() {
        return targetKanbanColumnId;
    }

    /** @param targetKanbanColumnId the target column ID to set */
    public void setTargetKanbanColumnId(Long targetKanbanColumnId) {
        this.targetKanbanColumnId = targetKanbanColumnId;
    }

    /** @return the zero-based index within the target column */
    public int getTargetPosition() {
        return targetPosition;
    }

    /** @param targetPosition the zero-based index to set */
    public void setTargetPosition(int targetPosition) {
        this.targetPosition = targetPosition;
    }
}
