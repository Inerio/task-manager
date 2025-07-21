package com.inerio.taskmanager.dto;

import com.inerio.taskmanager.model.KanbanColumn;
import com.inerio.taskmanager.model.Board;

/**
 * Utility class for mapping between KanbanColumn entity and KanbanColumnDto.
 * <p>
 * Static methods for converting entity to DTO and vice versa.
 * </p>
 */
public class KanbanColumnMapperDto {

    /** Private constructor to prevent instantiation. */
    private KanbanColumnMapperDto() {}

    /**
     * Converts a KanbanColumn entity to a KanbanColumnDto.
     *
     * @param column KanbanColumn entity.
     * @return Corresponding KanbanColumnDto.
     */
    public static KanbanColumnDto toDto(KanbanColumn column) {
        if (column == null) return null;
        Long boardId = column.getBoard() != null ? column.getBoard().getId() : null;
        return new KanbanColumnDto(
            column.getId(),
            column.getName(),
            column.getPosition(),
            boardId
        );
    }

    /**
     * Converts a KanbanColumnDto to a KanbanColumn entity.
     * Does not set the Board (must be set by service if needed).
     *
     * @param dto KanbanColumnDto.
     * @param board Board entity to associate with the column.
     * @return KanbanColumn entity.
     */
    public static KanbanColumn toEntity(KanbanColumnDto dto, Board board) {
        if (dto == null) return null;
        KanbanColumn entity = new KanbanColumn();
        entity.setId(dto.getId());
        entity.setName(dto.getName());
        entity.setPosition(dto.getPosition());
        entity.setBoard(board);
        return entity;
    }
}
