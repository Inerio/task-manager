package com.inerio.taskmanager.dto;

public class TaskListDto {
    private Long id;
    private String name;
    private int position;

    // Constructor
    public TaskListDto(Long id, String name, int position) {
        this.id = id;
        this.name = name;
        this.position = position;
    }

    // Getters & Setters
    public Long getId() { return id; }
    public String getName() { return name; }
    public int getPosition() { return position; }
}
