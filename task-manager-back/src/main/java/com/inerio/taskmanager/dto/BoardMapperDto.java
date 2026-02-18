package com.inerio.taskmanager.dto;

import com.inerio.taskmanager.model.Board;
import java.util.List;

/**
 * Utility mapper between {@link Board} entities and {@link BoardDto} objects.
 * <p>
 * Provides static mapping methods used by controllers/services to shape API payloads.
 * </p>
 */
public final class BoardMapperDto {

    private BoardMapperDto() { }

    /**
     * Converts a {@link Board} entity to a {@link BoardDto}, including its columns if present.
     *
     * @param board the source {@code Board} entity; may be {@code null}
     * @return a populated {@code BoardDto}, or {@code null} if {@code board} is {@code null}
     */
    public static BoardDto toDto(Board board) {
        if (board == null) return null;

        List<KanbanColumnDto> columns = (board.getKanbanColumns() != null)
            ? board.getKanbanColumns().stream()
                .map(KanbanColumnMapperDto::toDto)
                .toList()
            : null;

        return new BoardDto(
            board.getId(),
            board.getName(),
            board.getPosition(),
            columns
        );
    }
}
