package com.inerio.taskmanager.dto;

import java.util.List;

/**
 * Data Transfer Object for a Kanban board.
 * <p>
 * Carries board data between the backend and the client.
 * </p>
 */
public class BoardDto {

    /** Unique identifier of the board (nullable for creation). */
    private Long id;

    /** Display name of the board. */
    private String name;

    /** Zero-based ordering in the sidebar. */
    private Integer position;

    /** Columns belonging to this board. */
    private List<KanbanColumnDto> columns;

    /** Default no-args constructor (required by serialization frameworks). */
    public BoardDto() { }

    /**
     * Creates a fully-initialized {@code BoardDto}.
     *
     * @param id       the board identifier (nullable for new boards)
     * @param name     the display name of the board
     * @param position the zero-based position for ordering
     * @param columns  the list of columns belonging to this board
     */
    public BoardDto(Long id, String name, Integer position, List<KanbanColumnDto> columns) {
        this.id = id;
        this.name = name;
        this.position = position;
        this.columns = columns;
    }

    /**
     * Returns the board identifier.
     *
     * @return the board id, or {@code null} if not yet persisted
     */
    public Long getId() {
        return id;
    }

    /**
     * Sets the board identifier.
     *
     * @param id the board id
     */
    public void setId(Long id) {
        this.id = id;
    }

    /**
     * Returns the board name.
     *
     * @return the display name
     */
    public String getName() {
        return name;
    }

    /**
     * Sets the board name.
     *
     * @param name the display name
     */
    public void setName(String name) {
        this.name = name;
    }

    /**
     * Returns the board position (zero-based).
     *
     * @return the sidebar ordering index
     */
    public Integer getPosition() {
        return position;
    }

    /**
     * Sets the board position (zero-based).
     *
     * @param position the sidebar ordering index
     */
    public void setPosition(Integer position) {
        this.position = position;
    }

    /**
     * Returns the columns of this board.
     *
     * @return the list of column DTOs
     */
    public List<KanbanColumnDto> getColumns() {
        return columns;
    }

    /**
     * Sets the columns of this board.
     *
     * @param columns the list of column DTOs
     */
    public void setColumns(List<KanbanColumnDto> columns) {
        this.columns = columns;
    }
}
