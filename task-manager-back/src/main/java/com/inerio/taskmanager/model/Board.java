package com.inerio.taskmanager.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import java.util.ArrayList;
import java.util.List;

/**
 * Kanban board aggregate.
 * Holds a set of columns and belongs to a user (soft-identity).
 */
@Entity
public class Board {

    /** Database-generated identifier. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Display name. */
    @Column(nullable = false)
    private String name;

    /**
     * Zero-based order of this board in the sidebar.
     * May be null for legacy rows.
     */
    @Column
    private Integer position;

    /** Owner of this board (anonymous soft identity). */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private UserAccount owner;

    /**
     * Columns contained in this board.
     * Deleting a board cascades to its columns and tasks.
     */
    @OneToMany(
            mappedBy = "board",
            cascade = CascadeType.ALL,
            orphanRemoval = true,
            fetch = FetchType.LAZY
    )
    private List<KanbanColumn> kanbanColumns = new ArrayList<>();

    /** Default constructor for JPA. */
    public Board() { }

    /** Creates a board with the given name. */
    public Board(String name) {
        this.name = name;
    }

    /** @return the board id */
    public Long getId() {
        return id;
    }

    /** @return the board name */
    public String getName() {
        return name;
    }

    /** @param name new display name */
    public void setName(String name) {
        this.name = name;
    }

    /** @return the columns belonging to this board */
    public List<KanbanColumn> getKanbanColumns() {
        return kanbanColumns;
    }

    /**
     * Replaces the columns collection.
     * @param kanbanColumns new columns list (null becomes empty)
     */
    public void setKanbanColumns(List<KanbanColumn> kanbanColumns) {
        this.kanbanColumns = kanbanColumns != null ? kanbanColumns : new ArrayList<>();
    }

    /**
     * Adds a column and sets the reverse relation.
     * @param column column to add
     */
    public void addKanbanColumn(KanbanColumn column) {
        if (column != null) {
            kanbanColumns.add(column);
            column.setBoard(this);
        }
    }

    /**
     * Removes a column and clears the reverse relation.
     * @param column column to remove
     */
    public void removeKanbanColumn(KanbanColumn column) {
        if (column != null && kanbanColumns.remove(column)) {
            column.setBoard(null);
        }
    }

    /** @return the zero-based position */
    public Integer getPosition() {
        return position;
    }

    /** @param position zero-based position */
    public void setPosition(Integer position) {
        this.position = position;
    }

    /** @return the owner account */
    public UserAccount getOwner() {
        return owner;
    }

    /** @param owner owner account */
    public void setOwner(UserAccount owner) {
        this.owner = owner;
    }
}
