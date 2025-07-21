package com.inerio.taskmanager.dto;

import com.inerio.taskmanager.model.Board;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Utility class for mapping between Board entity and BoardDto.
 * <p>
 * Static methods for converting entity to DTO and vice versa.
 * </p>
 */
public class BoardMapperDto {

    /**
     * Default constructor for BoardMapperDto.
     */
    public BoardMapperDto() {}

    /**
     * Converts a Board entity to a BoardDto.
     *
     * @param board Board entity
     * @return Corresponding BoardDto
     */
    public static BoardDto toDto(Board board) {
        if (board == null) return null;
        List<KanbanColumnDto> columns = board.getKanbanColumns() != null
            ? board.getKanbanColumns().stream()
                .map(KanbanColumnMapperDto::toDto)
                .collect(Collectors.toList())
            : null;
        return new BoardDto(
            board.getId(),
            board.getName(),
            columns
        );
    }
}
