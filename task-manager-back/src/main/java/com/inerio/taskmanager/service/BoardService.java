package com.inerio.taskmanager.service;

import com.inerio.taskmanager.model.Board;
import com.inerio.taskmanager.model.KanbanColumn;
import com.inerio.taskmanager.repository.BoardRepository;
import com.inerio.taskmanager.repository.KanbanColumnRepository;
import com.inerio.taskmanager.repository.TaskRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.FileSystemUtils;

import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

/**
 * Service layer for managing Kanban boards.
 * <p>
 * Handles business logic and CRUD operations for Board entities and,
 * on deletion, cleans the on-disk attachment folders for all tasks belonging
 * to the board's columns.
 * </p>
 */
@Service
public class BoardService {

    private final BoardRepository boardRepository;
    private final KanbanColumnRepository kanbanColumnRepository;
    private final TaskRepository taskRepository;

    /**
     * Base upload directory on disk where task attachments are stored.
     * <p>
     * Defaults to {@code "uploads"} if the property is not set.
     * </p>
     */
    @Value("${app.upload-dir:uploads}")
    private String uploadDir;

    /**
     * Dependency injection constructor.
     *
     * @param boardRepository        the JPA repository for Board entities
     * @param kanbanColumnRepository the JPA repository for KanbanColumn entities
     * @param taskRepository         the JPA repository for Task entities
     */
    public BoardService(BoardRepository boardRepository,
                        KanbanColumnRepository kanbanColumnRepository,
                        TaskRepository taskRepository) {
        this.boardRepository = boardRepository;
        this.kanbanColumnRepository = kanbanColumnRepository;
        this.taskRepository = taskRepository;
    }

    /**
     * Gets all boards in the system, ordered by name (columns are eagerly fetched).
     *
     * @return list of all boards
     */
    public List<Board> getAllBoards() {
        return boardRepository.findAllByOrderByNameAsc();
    }

    /**
     * Gets a board by its unique ID (columns are eagerly fetched).
     *
     * @param id the board ID
     * @return Optional containing the board if found, or empty
     */
    public Optional<Board> getBoardById(Long id) {
        return boardRepository.findById(id);
    }

    /**
     * Gets a board by its unique name.
     *
     * @param name the board name
     * @return Optional containing the board if found, or empty
     */
    public Optional<Board> getBoardByName(String name) {
        return boardRepository.findByName(name);
    }

    /**
     * Creates a new board with the given name.
     *
     * @param board the Board entity to create (name required)
     * @return the persisted Board entity
     */
    public Board createBoard(Board board) {
        // You may want to add unique name constraint checks here.
        return boardRepository.save(board);
    }

    /**
     * Updates an existing board's name.
     *
     * @param id      the ID of the board to update
     * @param updated the board data (name)
     * @return the updated Board entity
     * @throws RuntimeException if board not found
     */
    public Board updateBoard(Long id, Board updated) {
        Board existing = boardRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Board not found with id " + id));
        existing.setName(updated.getName());
        return boardRepository.save(existing);
    }

    /**
     * Deletes a board by its ID, along with all its columns and tasks (cascade in DB),
     * then removes the on-disk upload folders for all tasks that belonged to that board.
     * <p>
     * Implementation detail:
     * <ol>
     *     <li>Collect all task IDs from the board's columns <b>before</b> deleting the board.</li>
     *     <li>Delete the board (JPA cascade deletes columns and tasks).</li>
     *     <li>Clean the file system folders {@code uploads/{taskId}}.</li>
     * </ol>
     * The filesystem cleanup is best-effort and will not fail the operation on I/O errors.
     * </p>
     *
     * @param id the ID of the board to delete
     * @throws RuntimeException if board not found
     */
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

    // ============== INTERNAL HELPERS ==============

    /**
     * Deletes the upload directory for a given task ID, ignoring any I/O errors.
     * <p>
     * Directory layout is assumed to be {@code ${app.upload-dir}/${taskId}}.
     * </p>
     *
     * @param taskId the task identifier
     */
    private void deleteTaskFolderQuiet(Long taskId) {
        try {
            FileSystemUtils.deleteRecursively(Path.of(uploadDir, String.valueOf(taskId)));
        } catch (Exception ignored) {
            // Intentionally ignore any filesystem errors to avoid breaking the delete flow.
        }
    }
}
