package com.inerio.taskmanager.dto;

/**
 * DTO representing a Kanban column move (reorder) request.
 * <p>
 * Used by the API to perform drag-and-drop reordering, e.g.
 * <code>PUT /api/v1/boards/{boardId}/kanbanColumns/move</code>.
 * </p>
 */
public class KanbanColumnMoveDto {

    /** Identifier of the column to move. */
    private Long kanbanColumnId;

    /** Target position for the column (1-based index). */
    private int targetPosition;

    /** Default constructor for serialization/deserialization. */
    public KanbanColumnMoveDto() { }

    /**
     * Creates a new move request.
     *
     * @param kanbanColumnId the ID of the column to move
     * @param targetPosition the 1-based position to move the column to
     */
    public KanbanColumnMoveDto(Long kanbanColumnId, int targetPosition) {
        this.kanbanColumnId = kanbanColumnId;
        this.targetPosition = targetPosition;
    }

    /**
     * Returns the ID of the column to move.
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
     * Returns the target position (1-based).
     *
     * @return the target position
     */
    public int getTargetPosition() {
        return targetPosition;
    }

    /**
     * Sets the target position (1-based).
     *
     * @param targetPosition the position to move the column to
     */
    public void setTargetPosition(int targetPosition) {
        this.targetPosition = targetPosition;
    }
}
