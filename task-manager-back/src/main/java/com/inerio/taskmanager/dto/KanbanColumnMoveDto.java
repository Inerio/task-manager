package com.inerio.taskmanager.dto;

/**
 * Data Transfer Object for moving (reordering) a Kanban column.
 * <p>
 * Used in the drag &amp; drop operation for columns, typically via /api/v1/columns/move.
 * </p>
 */
public class KanbanColumnMoveDto {

    /**
     * The ID of the column  to move.
     */
    private Long kanbanColumnId;

    /**
     * The new position (index) for the column after moving (1-based or 0-based, according to your backend logic).
     */
    private int targetPosition;

    /**
     * Default constructor required for Jackson deserialization.
     */
    public KanbanColumnMoveDto() {}

    /**
     * All-args constructor for explicit instantiation.
     *
     * @param kanbanColumnId         the ID of the column to move
     * @param targetPosition the target position to move the column to
     */
    public KanbanColumnMoveDto(Long kanbanColumnId, int targetPosition) {
        this.kanbanColumnId = kanbanColumnId;
        this.targetPosition = targetPosition;
    }

    /**
     * Gets the ID of the column to move.
     *
     * @return the column ID
     */
    public Long getKanbanColumnId() {
        return kanbanColumnId;
    }

    /**
     * Sets the ID of the column to move.
     *
     * @param kanbanColumnId the column ID
     */
    public void setKanbanColumnId(Long kanbanColumnId) {
        this.kanbanColumnId = kanbanColumnId;
    }

    /**
     * Gets the target position for the column.
     *
     * @return the target position (index)
     */
    public int getTargetPosition() {
        return targetPosition;
    }

    /**
     * Sets the target position for the column.
     *
     * @param targetPosition the target position (index)
     */
    public void setTargetPosition(int targetPosition) {
        this.targetPosition = targetPosition;
    }
}
