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
import jakarta.persistence.OrderBy;

import java.util.ArrayList;
import java.util.List;

/**
 * Kanban board column entity.
 * Holds an ordered list of {@link Task} and belongs to a {@link Board}.
 */
@Entity
public class KanbanColumn {

    /** Database-generated identifier. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Column display name. */
    @Column(nullable = false)
    private String name;

    /** Persistent index for ordering columns within a board (lower = leftmost). */
    @Column(nullable = false)
    private int position;

    /** Tasks contained in this column. */
    @OneToMany(
    	    mappedBy = "kanbanColumn",
    	    cascade = CascadeType.ALL,
    	    orphanRemoval = true,
    	    fetch = FetchType.LAZY
    	)
    	@OrderBy("position ASC, id ASC")
    	private List<Task> tasks = new ArrayList<>();

    /** Parent board (required). */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "board_id", nullable = false)
    private Board board;

    /** Default constructor for JPA. */
    public KanbanColumn() { }

    /**
     * Constructs a column with a name and position.
     *
     * @param name     column name
     * @param position zero-based position within the board
     */
    public KanbanColumn(String name, int position) {
        this.name = name;
        this.position = position;
    }

    /** @return column id */
    public Long getId() {
        return id;
    }

    /**
     * Sets the column id (framework use).
     * @param id identifier
     */
    public void setId(Long id) {
        this.id = id;
    }

    /** @return column name */
    public String getName() {
        return name;
    }

    /** @param name column name */
    public void setName(String name) {
        this.name = name;
    }

    /** @return zero-based position */
    public int getPosition() {
        return position;
    }

    /** @param position zero-based position */
    public void setPosition(int position) {
        this.position = position;
    }

    /**
     * Returns the tasks of this column.
     * Never {@code null}.
     *
     * @return list of tasks
     */
    public List<Task> getTasks() {
        return tasks;
    }

    /**
     * Replaces the list of tasks.
     * @param tasks tasks list (non-null; empty allowed)
     */
    public void setTasks(List<Task> tasks) {
        this.tasks = tasks != null ? tasks : new ArrayList<>();
    }

    /** @return parent board */
    public Board getBoard() {
        return board;
    }

    /** @param board parent board */
    public void setBoard(Board board) {
        this.board = board;
    }

    /**
     * Adds a task to this column and sets the reverse relation.
     *
     * @param task task to add
     */
    public void addTask(Task task) {
        if (task != null) {
            tasks.add(task);
            task.setKanbanColumn(this);
        }
    }

    /**
     * Removes a task from this column and clears its reverse relation.
     *
     * @param task task to remove
     */
    public void removeTask(Task task) {
        if (task != null && tasks.remove(task)) {
            task.setKanbanColumn(null);
        }
    }
}
