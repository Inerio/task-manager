package com.inerio.taskmanager.dto;

import com.inerio.taskmanager.model.Task;
import com.inerio.taskmanager.model.TaskList;

/**
 * Utility class for converting between Task entity and TaskDto.
 */
public class TaskMapper {

    /**
     * Converts a Task entity to a TaskDto.
     * @param task the entity to convert
     * @return corresponding TaskDto
     */
    public static TaskDto toDto(Task task) {
        TaskDto dto = new TaskDto();
        dto.setId(task.getId());
        dto.setTitle(task.getTitle());
        dto.setDescription(task.getDescription());
        dto.setCompleted(task.isCompleted());
        // Use null if the list is not set
        dto.setListId(task.getList() != null ? task.getList().getId() : null);
        dto.setCreationDate(task.getCreationDate());
        dto.setDueDate(task.getDueDate());
        dto.setAttachments(task.getAttachments());
        return dto;
    }

    /**
     * Converts a TaskDto and its parent list to a Task entity.
     * Note: creationDate and attachments are managed elsewhere.
     * @param dto the TaskDto to convert
     * @param list the parent TaskList entity
     * @return new Task entity
     */
    public static Task toEntity(TaskDto dto, TaskList list) {
        Task task = new Task();
        task.setTitle(dto.getTitle());
        task.setDescription(dto.getDescription());
        task.setCompleted(dto.isCompleted());
        task.setList(list);
        task.setDueDate(dto.getDueDate());
        // creationDate and attachments should be set in service/entity layer
        return task;
    }
}
