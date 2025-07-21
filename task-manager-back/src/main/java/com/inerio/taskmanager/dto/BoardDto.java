package com.inerio.taskmanager.dto;

import java.util.List;

/**
 * Data Transfer Object for Board (Kanban board).
 * <p>
 * Used for exchanging Board data between frontend (Angular) and backend (Spring Boot) via the API.
 * Contains essential properties for board display and logic.
 * </p>
 *
 * <ul>
 *     <li>Immutable ID (null for creation, set after persistence)</li>
 *     <li>Display name (required)</li>
 *     <li>List of KanbanColumnDto (the columns for this board)</li>
 * </ul>
 *
 * <p>
 * This class is a pure DTO: no business logic, only field structure.
 * </p>
 */
public class BoardDto {

    /** Unique identifier of the board (nullable for creation). */
    private Long id;

    /** Display name of the board. */
    private String name;

    /** Columns belonging to this board. */
    private List<KanbanColumnDto> columns;

    /** Default constructor (required by frameworks). */
    public BoardDto() {}

    /**
     * Full constructor for BoardDto.
     *
     * @param id      Board unique ID
     * @param name    Display name
     * @param columns Columns for this board
     */
    public BoardDto(Long id, String name, List<KanbanColumnDto> columns) {
        this.id = id;
        this.name = name;
        this.columns = columns;
    }

    /**
     * Gets the board ID.
     * @return Board ID.
     */
    public Long getId() { return id; }

    /**
     * Gets the board name.
     * @return Board name.
     */
    public String getName() { return name; }

    /**
     * Gets the list of Kanban columns for this board.
     * @return List of KanbanColumnDto.
     */
    public List<KanbanColumnDto> getColumns() { return columns; }

    /**
     * Sets the board ID.
     * @param id Board ID.
     */
    public void setId(Long id) { this.id = id; }

    /**
     * Sets the board name.
     * @param name Board name.
     */
    public void setName(String name) { this.name = name; }

    /**
     * Sets the columns list.
     * @param columns List of KanbanColumnDto.
     */
    public void setColumns(List<KanbanColumnDto> columns) { this.columns = columns; }
}
