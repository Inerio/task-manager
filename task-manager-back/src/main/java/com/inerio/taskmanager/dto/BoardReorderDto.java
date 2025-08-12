package com.inerio.taskmanager.dto;

/**
 * Minimal DTO to reorder boards.
 * Each entry conveys the board id and its target position (0-based).
 */
public class BoardReorderDto {
    private Long id;
    private Integer position;

    public BoardReorderDto() {}
    public BoardReorderDto(Long id, Integer position) {
        this.id = id;
        this.position = position;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Integer getPosition() { return position; }
    public void setPosition(Integer position) { this.position = position; }
}
