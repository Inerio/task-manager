package com.inerio.taskmanager.dto;

/**
 * Data Transfer Object (DTO) for representing a task reordering request.
 * <p>
 * Contains the task ID and its new position in the column.
 * </p>
 */
public class TaskReorderDto {
    private Long id;
    private int position;

    public TaskReorderDto() {}

    public TaskReorderDto(Long id, int position) {
        this.id = id;
        this.position = position;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
}
