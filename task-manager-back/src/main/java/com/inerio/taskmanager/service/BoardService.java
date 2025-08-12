package com.inerio.taskmanager.service;

import com.inerio.taskmanager.dto.BoardReorderDto;
import com.inerio.taskmanager.model.Board;
import com.inerio.taskmanager.model.KanbanColumn;
import com.inerio.taskmanager.repository.BoardRepository;
import com.inerio.taskmanager.repository.KanbanColumnRepository;
import com.inerio.taskmanager.repository.TaskRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.FileSystemUtils;

import java.nio.file.Path;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service layer for managing Kanban boards.
 */
@Service
public class BoardService {

    private final BoardRepository boardRepository;
    private final KanbanColumnRepository kanbanColumnRepository;
    private final TaskRepository taskRepository;

    @Value("${app.upload-dir:uploads}")
    private String uploadDir;

    private volatile boolean positionsInitialized = false;

    public BoardService(BoardRepository boardRepository,
                        KanbanColumnRepository kanbanColumnRepository,
                        TaskRepository taskRepository) {
        this.boardRepository = boardRepository;
        this.kanbanColumnRepository = kanbanColumnRepository;
        this.taskRepository = taskRepository;
    }

    /**
     * Initialize missing positions once.
     */
    private synchronized void initPositionsIfMissing() {
        if (positionsInitialized) return;

        List<Board> all = boardRepository.findAll();
        boolean needsSave = all.stream().anyMatch(b -> b.getPosition() == null);
        if (!needsSave) {
            positionsInitialized = true;
            return;
        }

        all.sort(Comparator.comparing(Board::getName, Comparator.nullsLast(String::compareToIgnoreCase)));
        int idx = 0;
        for (Board b : all) {
            b.setPosition(idx++);
        }
        boardRepository.saveAll(all);
        positionsInitialized = true;
    }

    /** Gets all boards in order. */
    public List<Board> getAllBoards() {
        initPositionsIfMissing();
        return boardRepository.findAllOrderByPositionAscNullsLast();
    }

    public Optional<Board> getBoardById(Long id) {
        return boardRepository.findById(id);
    }

    public Optional<Board> getBoardByName(String name) {
        return boardRepository.findByName(name);
    }

    /** Creates a new board at the end of the list. */
    public Board createBoard(Board board) {
        Integer max = boardRepository.findMaxPosition();
        int next = (max == null) ? 0 : (max + 1);
        board.setPosition(next);
        return boardRepository.save(board);
    }

    /** Updates an existing board's name. */
    public Board updateBoard(Long id, Board updated) {
        Board existing = boardRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Board not found with id " + id));
        existing.setName(updated.getName());
        return boardRepository.save(existing);
    }

    /**
     * Bulk reorder boards according to the given positions.
     * Positions are normalized to 0..n-1 in the order provided.
     */
    public void reorderBoards(List<BoardReorderDto> items) {
        if (items == null || items.isEmpty()) return;
        List<BoardReorderDto> ordered = items.stream()
            .sorted(Comparator.comparing(BoardReorderDto::getPosition)
                .thenComparing(BoardReorderDto::getId))
            .toList();

        Map<Long, Integer> targetOrder = new LinkedHashMap<>();
        int idx = 0;
        for (BoardReorderDto dto : ordered) {
            targetOrder.put(dto.getId(), idx++);
        }

        List<Board> boards = boardRepository.findAllById(targetOrder.keySet());
        Map<Long, Board> byId = boards.stream().collect(Collectors.toMap(Board::getId, b -> b));

        for (Map.Entry<Long, Integer> e : targetOrder.entrySet()) {
            Board b = byId.get(e.getKey());
            if (b != null) b.setPosition(e.getValue());
        }
        boardRepository.saveAll(boards);
    }

    /** Deletes a board and cleans up attachment folders of its tasks. */
    public void deleteBoard(Long id) {
        if (!boardRepository.existsById(id)) {
            throw new RuntimeException("Board not found with id " + id);
        }
        List<Long> taskIds = kanbanColumnRepository.findByBoardId(id).stream()
                .flatMap((KanbanColumn col) -> taskRepository.findByKanbanColumn(col).stream())
                .map(t -> t.getId())
                .toList();
        boardRepository.deleteById(id);
        taskIds.forEach(this::deleteTaskFolderQuiet);
    }

    private void deleteTaskFolderQuiet(Long taskId) {
        try {
            FileSystemUtils.deleteRecursively(Path.of(uploadDir, String.valueOf(taskId)));
        } catch (Exception ignored) { }
    }
}
