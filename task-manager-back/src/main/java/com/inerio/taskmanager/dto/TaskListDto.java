package com.inerio.taskmanager.dto;

/**
 * Data Transfer Object for a Kanban list/column (used for all list API exchanges).
 */
public class TaskListDto {
    // ------------------------------------------
    // PROPERTIES
    // ------------------------------------------
    private Long id;
    private String name;

    // ------------------------------------------
    // CONSTRUCTOR
    // ------------------------------------------
    public TaskListDto(Long id, String name) {
        this.id = id;
        this.name = name;
    }

    // ------------------------------------------
    // GETTERS
    // ------------------------------------------
    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }
}
