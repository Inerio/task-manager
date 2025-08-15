package com.inerio.taskmanager.dto;

import com.inerio.taskmanager.model.Board;
import com.inerio.taskmanager.model.KanbanColumn;

/**
 * Utility mapper between {@link KanbanColumn} entities and {@link KanbanColumnDto} DTOs.
 * <p>
 * Provides static, stateless conversions in both directions.
 * </p>
 */
public final class KanbanColumnMapperDto {

    /** Not instantiable. */
    private KanbanColumnMapperDto() { }

    /**
     * Converts a {@link KanbanColumn} entity to a {@link KanbanColumnDto}.
     *
     * @param column the entity to convert; may be {@code null}
     * @return the corresponding DTO, or {@code null} if {@code column} is {@code null}
     */
    public static KanbanColumnDto toDto(KanbanColumn column) {
        if (column == null) {
            return null;
        }
        Long boardId = column.getBoard() != null ? column.getBoard().getId() : null;
        return new KanbanColumnDto(
            column.getId(),
            column.getName(),
            column.getPosition(),
            boardId
        );
    }

    /**
     * Converts a {@link KanbanColumnDto} to a {@link KanbanColumn} entity.
     * <p>
     * The {@code board} association is set from the provided parameter; callers decide whether
     * to supply it or keep it {@code null} and set it later in the service layer.
     * </p>
     *
     * @param dto   the DTO to convert; may be {@code null}
     * @param board the parent {@link Board} to associate, or {@code null}
     * @return a new entity populated from the DTO, or {@code null} if {@code dto} is {@code null}
     */
    public static KanbanColumn toEntity(KanbanColumnDto dto, Board board) {
        if (dto == null) {
            return null;
        }
        KanbanColumn entity = new KanbanColumn();
        entity.setId(dto.getId());
        entity.setName(dto.getName());
        entity.setPosition(dto.getPosition());
        entity.setBoard(board);
        return entity;
    }
}
