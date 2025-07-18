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
 *     <li>Stable position for drag &amp; drop ordering</li>
 * </ul>
 *
 * <p>
 * This class is a pure DTO: no business logic, only field structure.
 * </p>
 */
public class KanbanColumnDto {

    /**
     * Unique identifier of the column.
     * <p>
     * May be null for creation requests.
     * </p>
     */
    private Long id;

    /**
     * Display name of the column (e.g. "To Do", "In Progress").
     * <p>
     * Must be unique in database.
     * </p>
     */
    private String name;

    /**
     * Persistent display position (used for ordering columns).
     * <p>
     * Lower values mean columns are shown leftmost.
     * </p>
     */
    private int position;

    // ===========================
    //   CONSTRUCTORS
    // ===========================

    /**
     * Default no-args constructor required for frameworks (e.g. Jackson).
     */
    public KanbanColumnDto() {}
    
    /**
     * Main constructor for KanbanColumnDto.
     *
     * @param id       Column unique ID
     * @param name     Display name
     * @param position Persistent position/index (for ordering)
     */
    public KanbanColumnDto(Long id, String name, int position) {
        this.id = id;
        this.name = name;
        this.position = position;
    }

    // ===========================
    //   GETTERS
    // ===========================

    /**
     * Gets the column unique ID.
     * @return the column ID, or null if not set
     */
    public Long getId() { return id; }

    /**
     * Gets the display name of the column.
     * @return the column name (never null)
     */
    public String getName() { return name; }

    /**
     * Gets the persistent position of the column.
     * @return the position/index
     */
    public int getPosition() { return position; }
}
