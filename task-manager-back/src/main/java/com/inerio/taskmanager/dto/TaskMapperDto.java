package com.inerio.taskmanager.dto;

import com.inerio.taskmanager.model.KanbanColumn;
import com.inerio.taskmanager.model.Task;

/**
 * Mapper for converting between {@link Task} entities and {@link TaskDto} objects.
 * Provides static methods only and is not intended to be instantiated.
 */
public final class TaskMapperDto {

    /**
     * Converts a {@link Task} entity to a {@link TaskDto}.
     *
     * @param task the entity to convert; must not be {@code null}
     * @return the corresponding DTO
     * @throws IllegalArgumentException if {@code task} is {@code null}
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
        dto.setKanbanColumnId(task.getKanbanColumn() != null ? task.getKanbanColumn().getId() : null);
        dto.setPosition(task.getPosition());
        dto.setCreationDate(task.getCreationDate());
        dto.setDueDate(task.getDueDate());
        dto.setAttachments(task.getAttachments());
        return dto;
    }

    /**
     * Creates a new {@link Task} entity from a {@link TaskDto} and its parent {@link KanbanColumn}.
     * <p>
     * Note: {@code creationDate} and {@code attachments} are managed elsewhere and are not set here.
     * </p>
     *
     * @param dto the source DTO; must not be {@code null}
     * @param kanbanColumn the parent column; must not be {@code null}
     * @return a new {@link Task} populated from the DTO
     * @throws IllegalArgumentException if {@code dto} or {@code kanbanColumn} is {@code null}
     */
    public static Task toEntity(TaskDto dto, KanbanColumn kanbanColumn) {
        if (dto == null) {
            throw new IllegalArgumentException("TaskDto must not be null");
        }
        if (kanbanColumn == null) {
            throw new IllegalArgumentException("KanbanColumn must not be null");
        }
        Task task = new Task();
        task.setTitle(dto.getTitle());
        task.setDescription(dto.getDescription());
        task.setCompleted(dto.isCompleted());
        task.setKanbanColumn(kanbanColumn);
        task.setDueDate(dto.getDueDate());
        task.setPosition(dto.getPosition());
        return task;
    }

    private TaskMapperDto() {
        // Utility class; prevent instantiation.
    }
}
