package com.inerio.taskmanager.dto;

import com.inerio.taskmanager.model.Task;
import com.inerio.taskmanager.model.TaskList;

/**
 * Utility class for converting between {@link Task} entity and {@link TaskDto}.
 * <p>
 * This class contains only static mapping methods (Entity <-> DTO) to ensure clean
 * separation between database models and objects exchanged with the frontend (Angular).
 * </p>
 *
 * <ul>
 *     <li>toDto: Converts an entity to its DTO for API responses</li>
 *     <li>toEntity: Creates a Task entity from a DTO and its parent list</li>
 * </ul>
 *
 * <p>
 * No state or business logic should be added here.
 * </p>
 */
public class TaskMapper {

    /**
     * Converts a {@link Task} entity to a {@link TaskDto} for API exchange.
     *
     * @param task The entity to convert (must not be null)
     * @return The corresponding TaskDto (never null)
     */
    public static TaskDto toDto(Task task) {
        if (task == null) {
            throw new IllegalArgumentException("Task entity must not be null");
        }
        TaskDto dto = new TaskDto();
        dto.setId(task.getId());
        dto.setTitle(task.getTitle());
        dto.setDescription(task.getDescription());
        dto.setCompleted(task.isCompleted());
        dto.setListId(task.getList() != null ? task.getList().getId() : null);
        dto.setPosition(task.getPosition());
        dto.setCreationDate(task.getCreationDate());
        dto.setDueDate(task.getDueDate());
        dto.setAttachments(task.getAttachments());
        return dto;
    }

    /**
     * Converts a {@link TaskDto} and its parent {@link TaskList} to a new {@link Task} entity.
     * <p>
     * <b>Note:</b> creationDate and attachments are managed elsewhere (not set here).
     * </p>
     *
     * @param dto  The TaskDto to convert (must not be null)
     * @param list The parent TaskList entity (must not be null)
     * @return A new Task entity populated from the DTO
     */
    public static Task toEntity(TaskDto dto, TaskList list) {
        if (dto == null) {
            throw new IllegalArgumentException("TaskDto must not be null");
        }
        if (list == null) {
            throw new IllegalArgumentException("TaskList must not be null");
        }
        Task task = new Task();
        task.setTitle(dto.getTitle());
        task.setDescription(dto.getDescription());
        task.setCompleted(dto.isCompleted());
        task.setList(list);
        task.setDueDate(dto.getDueDate());
        task.setPosition(dto.getPosition());
        // creationDate and attachments are set in service/entity layer
        return task;
    }

    // Private constructor to prevent instantiation (utility class)
    private TaskMapper() {}
}
