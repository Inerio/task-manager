package com.inerio.taskmanager.dto;

/**
 * Data Transfer Object representing a board reorder instruction.
 * <p>
 * Carries the board identifier and its target zero-based position for bulk reordering
 * (e.g., via <b>PUT</b> <code>/api/v1/boards/reorder</code>).
 * </p>
 */
public class BoardReorderDto {

    /** Unique identifier of the board to reorder. */
    private Long id;

    /** Target zero-based position for the board. */
    private Integer position;

    /** Default constructor (required by serialization frameworks). */
    public BoardReorderDto() { }

    /**
     * All-args constructor.
     *
     * @param id       the board identifier
     * @param position the target zero-based position
     */
    public BoardReorderDto(Long id, Integer position) {
        this.id = id;
        this.position = position;
    }

    /**
     * Returns the board identifier.
     *
     * @return the board id
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
     * Returns the target zero-based position.
     *
     * @return the target position
     */
    public Integer getPosition() {
        return position;
    }

    /**
     * Sets the target zero-based position.
     *
     * @param position the target position
     */
    public void setPosition(Integer position) {
        this.position = position;
    }
}
