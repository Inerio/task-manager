package com.inerio.taskmanager.dto;

/**
 * DTO representing a single task's target position during a reorder operation.
 * <p>
 * Consumed by the <b>PUT</b> {@code /api/v1/tasks/reorder} endpoint, where the
 * client sends a list of (task {@code id}, new {@code position}) pairs for a column.
 * </p>
 */
public class TaskReorderDto {

    /** ID of the task to reorder. */
    private Long id;

    /** Zero-based target position within its column. */
    private int position;

    /** Default constructor for serialization frameworks. */
    public TaskReorderDto() { }

    /**
     * Creates a new {@code TaskReorderDto}.
     *
     * @param id       the task ID
     * @param position the zero-based target position
     */
    public TaskReorderDto(Long id, int position) {
        this.id = id;
        this.position = position;
    }

    /** @return the task ID */
    public Long getId() {
        return id;
    }

    /** @param id the task ID to set */
    public void setId(Long id) {
        this.id = id;
    }

    /** @return the zero-based target position */
    public int getPosition() {
        return position;
    }

    /** @param position the zero-based target position to set */
    public void setPosition(int position) {
        this.position = position;
    }
}
