package com.inerio.taskmanager.dto;

import java.util.List;

/**
 * Data Transfer Object for Board (Kanban board).
 * <p>
 * Used for exchanging Board data between frontend (Angular) and backend (Spring Boot) via the API.
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

    /** Default constructor (required by frameworks). */
    public BoardDto() {}

    public BoardDto(Long id, String name, Integer position, List<KanbanColumnDto> columns) {
        this.id = id;
        this.name = name;
        this.position = position;
        this.columns = columns;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public Integer getPosition() { return position; }
    public List<KanbanColumnDto> getColumns() { return columns; }

    public void setId(Long id) { this.id = id; }
    public void setName(String name) { this.name = name; }
    public void setPosition(Integer position) { this.position = position; }
    public void setColumns(List<KanbanColumnDto> columns) { this.columns = columns; }
}
