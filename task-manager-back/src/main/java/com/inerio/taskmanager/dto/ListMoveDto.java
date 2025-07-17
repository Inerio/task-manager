package com.inerio.taskmanager.dto;

/**
 * Data Transfer Object for moving (reordering) a Kanban list (column).
 * <p>
 * Used in the drag &amp; drop operation for lists, typically via /api/v1/lists/move.
 * </p>
 */
public class ListMoveDto {

    /**
     * The ID of the list (column) to move.
     */
    private Long listId;

    /**
     * The new position (index) for the list after moving (1-based or 0-based, according to your backend logic).
     */
    private int targetPosition;

    /**
     * Default constructor required for Jackson deserialization.
     */
    public ListMoveDto() {}

    /**
     * All-args constructor for explicit instantiation.
     *
     * @param listId         the ID of the list to move
     * @param targetPosition the target position to move the list to
     */
    public ListMoveDto(Long listId, int targetPosition) {
        this.listId = listId;
        this.targetPosition = targetPosition;
    }

    /**
     * Gets the ID of the list to move.
     *
     * @return the list ID
     */
    public Long getListId() {
        return listId;
    }

    /**
     * Sets the ID of the list to move.
     *
     * @param listId the list ID
     */
    public void setListId(Long listId) {
        this.listId = listId;
    }

    /**
     * Gets the target position for the list.
     *
     * @return the target position (index)
     */
    public int getTargetPosition() {
        return targetPosition;
    }

    /**
     * Sets the target position for the list.
     *
     * @param targetPosition the target position (index)
     */
    public void setTargetPosition(int targetPosition) {
        this.targetPosition = targetPosition;
    }
}
