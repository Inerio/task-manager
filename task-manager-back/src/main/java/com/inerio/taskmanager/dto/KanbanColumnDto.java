package com.inerio.taskmanager.dto;

/**
 * DTO for a Kanban column.
 * <p>
 * Carries the minimal data needed by the API/UI: identifier, display name,
 * stable position for ordering, and the parent board identifier.
 * </p>
 */
public class KanbanColumnDto {

    /** Unique identifier of the column (nullable for creation). */
    private Long id;

    /** Display name of the column. */
    private String name;

    /** Stable display position within the board (lower = further left). */
    private int position;

    /** Identifier of the parent board. */
    private Long boardId;

    /** Default constructor for serialization frameworks. */
    public KanbanColumnDto() { }

    /**
     * Creates a new {@code KanbanColumnDto}.
     *
     * @param id       the column ID
     * @param name     the display name
     * @param position the stable position within the board
     * @param boardId  the parent board ID
     */
    public KanbanColumnDto(Long id, String name, int position, Long boardId) {
        this.id = id;
        this.name = name;
        this.position = position;
        this.boardId = boardId;
    }

    /** @return the column ID (nullable on create) */
    public Long getId() {
        return id;
    }

    /** @param id the column ID to set */
    public void setId(Long id) {
        this.id = id;
    }

    /** @return the column display name */
    public String getName() {
        return name;
    }

    /** @param name the column display name to set */
    public void setName(String name) {
        this.name = name;
    }

    /** @return the stable position within the board */
    public int getPosition() {
        return position;
    }

    /** @param position the stable position to set */
    public void setPosition(int position) {
        this.position = position;
    }

    /** @return the parent board ID */
    public Long getBoardId() {
        return boardId;
    }

    /** @param boardId the parent board ID to set */
    public void setBoardId(Long boardId) {
        this.boardId = boardId;
    }
}
