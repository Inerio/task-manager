package com.inerio.taskmanager.dto;

/**
 * Data Transfer Object for KanbanColumn (Kanban column).
 * <p>
 * Used for exchanging Kanban column data between frontend (Angular) and backend (Spring Boot) via the API.
 * Contains essential properties for board display and logic.
 * </p>
 *
 * <ul>
 *     <li>Immutable ID (null for creation, set after persistence)</li>
 *     <li>Display name (required)</li>
 *     <li>Stable position for drag and drop ordering</li>
 *     <li>Reference to parent board by ID (boardId)</li>
 * </ul>
 *
 * <p>
 * This class is a pure DTO: no business logic, only field structure.
 * </p>
 */
public class KanbanColumnDto {

    /** Unique identifier of the column (nullable for creation). */
    private Long id;

    /** Display name of the column. */
    private String name;

    /** Persistent display position (for ordering columns on board). */
    private int position;

    /** Reference to the parent board by ID. */
    private Long boardId;

    // =========================
    //      CONSTRUCTORS
    // =========================

    /** Default no-args constructor (required for frameworks). */
    public KanbanColumnDto() {}

    /**
     * Full constructor for KanbanColumnDto.
     *
     * @param id       Column unique ID
     * @param name     Display name
     * @param position Persistent position/index (for ordering)
     * @param boardId  ID of the parent board
     */
    public KanbanColumnDto(Long id, String name, int position, Long boardId) {
        this.id = id;
        this.name = name;
        this.position = position;
        this.boardId = boardId;
    }

    /**
     * Gets the column ID.
     * @return Column ID.
     */
    public Long getId() { return id; }

    /**
     * Gets the column name.
     * @return Column name.
     */
    public String getName() { return name; }

    /**
     * Gets the position of the column.
     * @return Position index.
     */
    public int getPosition() { return position; }

    /**
     * Gets the parent board ID.
     * @return Board ID.
     */
    public Long getBoardId() { return boardId; }

    /**
     * Sets the column ID.
     * @param id Column ID.
     */
    public void setId(Long id) { this.id = id; }

    /**
     * Sets the column name.
     * @param name Column name.
     */
    public void setName(String name) { this.name = name; }

    /**
     * Sets the column position.
     * @param position Position index.
     */
    public void setPosition(int position) { this.position = position; }

    /**
     * Sets the board ID.
     * @param boardId Board ID.
     */
    public void setBoardId(Long boardId) { this.boardId = boardId; }
}
