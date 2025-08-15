package com.inerio.taskmanager.service;

import com.inerio.taskmanager.config.AppProperties;
import com.inerio.taskmanager.dto.KanbanColumnDto;
import com.inerio.taskmanager.model.Board;
import com.inerio.taskmanager.model.KanbanColumn;
import com.inerio.taskmanager.repository.BoardRepository;
import com.inerio.taskmanager.repository.KanbanColumnRepository;
import com.inerio.taskmanager.repository.TaskRepository;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.util.FileSystemUtils;

/**
 * Service for managing Kanban columns.
 * Provides CRUD operations, ordering, and cleanup of task attachment folders when columns are removed.
 */
@Service
public class KanbanColumnService {

    private final KanbanColumnRepository kanbanColumnRepository;
    private final BoardRepository boardRepository;
    private final TaskRepository taskRepository;
    private final Path baseUploadDir;

    public KanbanColumnService(KanbanColumnRepository kanbanColumnRepository,
                               BoardRepository boardRepository,
                               TaskRepository taskRepository,
                               AppProperties props) {
        this.kanbanColumnRepository = kanbanColumnRepository;
        this.boardRepository = boardRepository;
        this.taskRepository = taskRepository;
        this.baseUploadDir = Path.of(props.getUploadDir()).toAbsolutePath().normalize();
    }

    public List<KanbanColumn> getAllKanbanColumns(Long boardId) {
        Board board = getBoardOrThrow(boardId);
        return kanbanColumnRepository.findByBoardOrderByPositionAsc(board);
    }

    public Optional<KanbanColumn> getKanbanColumnById(Long id) {
        return kanbanColumnRepository.findById(id);
    }

    public KanbanColumn createKanbanColumn(KanbanColumn kanbanColumn, Long boardId) {
        Board board = getBoardOrThrow(boardId);
        long count = kanbanColumnRepository.countByBoard(board);
        if (count >= 5) throw new IllegalStateException("Maximum number of columns (5) reached for this board");

        Integer maxPos = kanbanColumnRepository.findByBoardOrderByPositionAsc(board).stream()
                .map(KanbanColumn::getPosition).max(Integer::compareTo).orElse(0);

        kanbanColumn.setPosition(maxPos + 1);
        kanbanColumn.setBoard(board);
        return kanbanColumnRepository.save(kanbanColumn);
    }

    public KanbanColumn updateKanbanColumn(Long id, KanbanColumn updated) {
        KanbanColumn existing = kanbanColumnRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("KanbanColumn not found with id " + id));
        existing.setName(updated.getName());
        if (updated.getPosition() != existing.getPosition()) {
            existing.setPosition(updated.getPosition());
        }
        return kanbanColumnRepository.save(existing);
    }

    public void deleteKanbanColumn(Long id) {
        KanbanColumn column = kanbanColumnRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("KanbanColumn not found with id " + id));
        Board board = column.getBoard();

        List<Long> taskIds = taskRepository.findByKanbanColumn(column).stream().map(t -> t.getId()).toList();

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

    private Board getBoardOrThrow(Long boardId) {
        return boardRepository.findById(boardId)
                .orElseThrow(() -> new RuntimeException("Board not found with id " + boardId));
    }

    private void deleteTaskFolderQuiet(Long taskId) {
        try {
            FileSystemUtils.deleteRecursively(baseUploadDir.resolve(String.valueOf(taskId)));
        } catch (Exception ignored) { }
    }
}
