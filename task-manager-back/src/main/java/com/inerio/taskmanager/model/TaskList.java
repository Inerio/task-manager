package com.inerio.taskmanager.model;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

/**
 * Entity representing a Kanban list/column (example: "To Do", "In Progress").
 */
@Entity
public class TaskList {

    // ------------------------------------------
    // PRIMARY KEY
    // ------------------------------------------
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ------------------------------------------
    // BASIC FIELDS
    // ------------------------------------------
    @Column(nullable = false, unique = true)
    private String name;

    /** Position (ordering index) for stable display. */
    @Column(nullable = false)
    private int position;

    // ------------------------------------------
    // RELATIONSHIPS
    // ------------------------------------------
    /** List of tasks contained in this column. */
    @OneToMany(
        mappedBy = "list",
        cascade = CascadeType.ALL,
        orphanRemoval = true,
        fetch = FetchType.LAZY
    )
    private List<Task> tasks = new ArrayList<>();

    // ------------------------------------------
    // GETTERS & SETTERS
    // ------------------------------------------
    public Long getId() { return id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }

    public List<Task> getTasks() { return tasks; }
    public void setTasks(List<Task> tasks) { this.tasks = tasks; }
}
