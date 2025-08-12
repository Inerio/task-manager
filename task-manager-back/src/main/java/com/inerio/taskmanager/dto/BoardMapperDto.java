package com.inerio.taskmanager.dto;

import com.inerio.taskmanager.model.Board;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Utility class for mapping between Board entity and BoardDto.
 */
public class BoardMapperDto {

    public BoardMapperDto() {}

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
            board.getPosition(),
            columns
        );
    }
}
