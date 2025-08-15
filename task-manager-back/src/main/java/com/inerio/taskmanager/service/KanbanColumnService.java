package com.inerio.taskmanager.service;

import com.inerio.taskmanager.dto.KanbanColumnDto;
import com.inerio.taskmanager.model.Board;
import com.inerio.taskmanager.model.KanbanColumn;
import com.inerio.taskmanager.repository.BoardRepository;
import com.inerio.taskmanager.repository.KanbanColumnRepository;
import com.inerio.taskmanager.repository.TaskRepository;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.FileSystemUtils;

/**
 * Service for managing Kanban columns.
 * <p>
 * Provides CRUD operations, ordering, and cleanup of task attachment folders when columns are removed.
 * </p>
 */
@Service
public class KanbanColumnService {

    private final KanbanColumnRepository kanbanColumnRepository;
    private final BoardRepository boardRepository;
    private final TaskRepository taskRepository;

    /**
     * Base upload directory on disk where task attachments are stored.
     * Defaults to {@code "uploads"}.
     */
    @Value("${app.upload-dir:uploads}")
    private String uploadDir;

    /**
     * Creates a new {@code KanbanColumnService}.
     *
     * @param kanbanColumnRepository repository for {@link KanbanColumn}
     * @param boardRepository        repository for {@link Board}
     * @param taskRepository         repository for task lookups during cleanup
     */
    public KanbanColumnService(
            KanbanColumnRepository kanbanColumnRepository,
            BoardRepository boardRepository,
            TaskRepository taskRepository) {
        this.kanbanColumnRepository = kanbanColumnRepository;
        this.boardRepository = boardRepository;
        this.taskRepository = taskRepository;
    }

    /**
     * Returns all columns for a board, ordered by position.
     *
     * @param boardId board identifier
     * @return ordered list of columns
     * @throws RuntimeException if the board does not exist
     */
    public List<KanbanColumn> getAllKanbanColumns(Long boardId) {
        Board board = getBoardOrThrow(boardId);
        return kanbanColumnRepository.findByBoardOrderByPositionAsc(board);
    }

    /**
     * Finds a column by its identifier.
     *
     * @param id column identifier
     * @return optional column
     */
    public Optional<KanbanColumn> getKanbanColumnById(Long id) {
        return kanbanColumnRepository.findById(id);
    }

    /**
     * Creates a new column at the last position on the given board.
     * Enforces a maximum of 5 columns per board.
     *
     * @param kanbanColumn column to create
     * @param boardId      target board identifier
     * @return persisted column
     * @throws IllegalStateException if the board already has 5 columns
     * @throws RuntimeException      if the board does not exist
     */
    public KanbanColumn createKanbanColumn(KanbanColumn kanbanColumn, Long boardId) {
        Board board = getBoardOrThrow(boardId);
        long count = kanbanColumnRepository.countByBoard(board);
        if (count >= 5) {
            throw new IllegalStateException("Maximum number of columns (5) reached for this board");
        }

        Integer maxPos = kanbanColumnRepository.findByBoardOrderByPositionAsc(board).stream()
                .map(KanbanColumn::getPosition)
                .max(Integer::compareTo)
                .orElse(0);

        kanbanColumn.setPosition(maxPos + 1);
        kanbanColumn.setBoard(board);
        return kanbanColumnRepository.save(kanbanColumn);
    }

    /**
     * Updates a column's name and, when provided, its position.
     *
     * @param id      column identifier
     * @param updated new column data
     * @return updated column
     * @throws RuntimeException if the column does not exist
     */
    public KanbanColumn updateKanbanColumn(Long id, KanbanColumn updated) {
        KanbanColumn existing = kanbanColumnRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("KanbanColumn not found with id " + id));
        existing.setName(updated.getName());
        if (updated.getPosition() != existing.getPosition()) {
            existing.setPosition(updated.getPosition());
        }
        return kanbanColumnRepository.save(existing);
    }

    /**
     * Deletes a column, compacts positions of remaining columns,
     * and removes attachment folders for tasks that belonged to the deleted column.
     *
     * @param id column identifier
     * @throws RuntimeException if the column does not exist
     */
    public void deleteKanbanColumn(Long id) {
        KanbanColumn column = kanbanColumnRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("KanbanColumn not found with id " + id));
        Board board = column.getBoard();

        List<Long> taskIds = taskRepository.findByKanbanColumn(column)
                .stream()
                .map(t -> t.getId())
                .toList();

        kanbanColumnRepository.deleteById(id);

        List<KanbanColumn> remaining = kanbanColumnRepository.findByBoardOrderByPositionAsc(board);
        int pos = 1;
        for (KanbanColumn kc : remaining) {
            if (kc.getPosition() != pos) {
                kc.setPosition(pos);
                kanbanColumnRepository.save(kc);
            }
            pos++;
        }

        taskIds.forEach(this::deleteTaskFolderQuiet);
    }

    /**
     * Moves a column to a new position within its board and reassigns positions contiguously.
     *
     * @param kanbanColumnId column identifier
     * @param targetPosition new 1-based position
     * @throws RuntimeException if the column does not exist
     */
    public void moveKanbanColumn(Long kanbanColumnId, int targetPosition) {
        KanbanColumn toMove = kanbanColumnRepository.findById(kanbanColumnId)
                .orElseThrow(() -> new RuntimeException("KanbanColumn not found with id " + kanbanColumnId));
        Board board = toMove.getBoard();

        List<KanbanColumn> columns = kanbanColumnRepository.findByBoardOrderByPositionAsc(board);
        columns.removeIf(col -> col.getId().equals(kanbanColumnId));

        int newPos = Math.max(1, Math.min(targetPosition, columns.size() + 1));
        columns.add(newPos - 1, toMove);

        for (int i = 0; i < columns.size(); i++) {
            KanbanColumn col = columns.get(i);
            col.setPosition(i + 1);
            kanbanColumnRepository.save(col);
        }
    }

    /**
     * Returns all columns for a board as DTOs, ordered by position.
     *
     * @param boardId board identifier
     * @return list of DTOs
     * @throws RuntimeException if the board does not exist
     */
    public List<KanbanColumnDto> getAllKanbanColumnDtos(Long boardId) {
        Board board = getBoardOrThrow(boardId);
        return kanbanColumnRepository.findByBoardOrderByPositionAsc(board).stream()
                .map(kanbanColumn -> new KanbanColumnDto(
                        kanbanColumn.getId(),
                        kanbanColumn.getName(),
                        kanbanColumn.getPosition(),
                        board.getId()))
                .toList();
    }

    /**
     * Returns the board for the given id or throws if not found.
     *
     * @param boardId board identifier
     * @return board entity
     * @throws RuntimeException if the board does not exist
     */
    private Board getBoardOrThrow(Long boardId) {
        return boardRepository.findById(boardId)
                .orElseThrow(() -> new RuntimeException("Board not found with id " + boardId));
    }

    /**
     * Deletes the upload directory for a task id, ignoring errors.
     *
     * @param taskId task identifier
     */
    private void deleteTaskFolderQuiet(Long taskId) {
        try {
            FileSystemUtils.deleteRecursively(Path.of(uploadDir, String.valueOf(taskId)));
        } catch (Exception ignored) {
            // Intentionally ignored
        }
    }
}
