package com.inerio.taskmanager.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Data Transfer Object for tasks (used in all API exchanges).
 */
public class TaskDto {
    // ------------------------------------------
    // PROPERTIES
    // ------------------------------------------
    private Long id;
    private String title;
    private String description;
    private boolean completed;
    private Long listId;
    private LocalDateTime creationDate;
    private LocalDate dueDate;
    private List<String> attachments;

    // ------------------------------------------
    // GETTERS & SETTERS
    // ------------------------------------------

    public Long getId() {
        return id;
    }
    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }
    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }
    public void setDescription(String description) {
        this.description = description;
    }

    public boolean isCompleted() {
        return completed;
    }
    public void setCompleted(boolean completed) {
        this.completed = completed;
    }

    public Long getListId() {
        return listId;
    }
    public void setListId(Long listId) {
        this.listId = listId;
    }

    public LocalDateTime getCreationDate() {
        return creationDate;
    }
    public void setCreationDate(LocalDateTime creationDate) {
        this.creationDate = creationDate;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }
    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public List<String> getAttachments() {
        return attachments;
    }
    public void setAttachments(List<String> attachments) {
        this.attachments = attachments;
    }
}
