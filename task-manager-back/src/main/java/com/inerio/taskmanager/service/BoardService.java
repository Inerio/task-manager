package com.inerio.taskmanager.service;

import com.inerio.taskmanager.dto.BoardReorderDto;
import com.inerio.taskmanager.model.Board;
import com.inerio.taskmanager.model.KanbanColumn;
import com.inerio.taskmanager.model.UserAccount;
import com.inerio.taskmanager.repository.BoardRepository;
import com.inerio.taskmanager.repository.KanbanColumnRepository;
import com.inerio.taskmanager.repository.TaskRepository;
import java.nio.file.Path;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.FileSystemUtils;

/**
 * Service for managing Kanban boards and related data, scoped by an anonymous user UID.
 * <p>
 * Provides CRUD operations, ordering, and ownership checks. Also performs
 * on-disk cleanup of task attachment folders when boards are removed.
 * </p>
 */
@Service
public class BoardService {

    private final BoardRepository boardRepository;
    private final KanbanColumnRepository kanbanColumnRepository;
    private final TaskRepository taskRepository;
    private final UserAccountService userAccountService;

    @Value("${app.upload-dir:uploads}")
    private String uploadDir;

    /** Tracks which owners have had their legacy null positions initialized. */
    private final Set<String> ownersWithPositionsInitialized =
            Collections.synchronizedSet(new HashSet<>());

    public BoardService(
            BoardRepository boardRepository,
            KanbanColumnRepository kanbanColumnRepository,
            TaskRepository taskRepository,
            UserAccountService userAccountService) {
        this.boardRepository = boardRepository;
        this.kanbanColumnRepository = kanbanColumnRepository;
        this.taskRepository = taskRepository;
        this.userAccountService = userAccountService;
    }

    /**
     * Returns all boards for the given owner UID in display order.
     *
     * @param uid owner UID
     * @return ordered list of boards
     */
    public List<Board> getAllBoards(String uid) {
        initPositionsIfMissing(uid);
        return boardRepository.findAllByOwnerUidOrderByPositionAscNullsLast(uid);
    }

    /**
     * Returns a board by id, scoped to the given owner UID.
     *
     * @param uid owner UID
     * @param id  board id
     * @return optional board if it belongs to the owner
     */
    public Optional<Board> getBoardById(String uid, Long id) {
        return boardRepository.findByIdAndOwnerUid(id, uid);
    }

    /**
     * Creates a new board at the end of the owner's list.
     *
     * @param uid   owner UID
     * @param board transient board entity (name required)
     * @return persisted board
     */
    public Board createBoard(String uid, Board board) {
        UserAccount owner = userAccountService.getOrCreate(uid);
        Integer max = boardRepository.findMaxPositionByOwnerUid(uid);
        int next = (max == null) ? 0 : (max + 1);
        board.setPosition(next);
        board.setOwner(owner);
        return boardRepository.save(board);
    }

    /**
     * Updates an existing board's name when it belongs to the owner.
     *
     * @param uid     owner UID
     * @param id      board id
     * @param updated board carrying the new name
     * @return updated board
     * @throws RuntimeException if the board does not exist or is not owned by the UID
     */
    public Board updateBoard(String uid, Long id, Board updated) {
        Board existing = boardRepository.findByIdAndOwnerUid(id, uid)
                .orElseThrow(() -> new RuntimeException("Board not found with id " + id));
        existing.setName(updated.getName());
        return boardRepository.save(existing);
    }

    /**
     * Reorders boards for the given owner according to the provided target positions.
     * Positions are normalized to a contiguous range starting at zero.
     *
     * @param uid   owner UID
     * @param items list of (id, position) pairs
     * @throws RuntimeException if any board in the list does not belong to the owner
     */
    public void reorderBoards(String uid, List<BoardReorderDto> items) {
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

        List<Board> boards = boardRepository.findAllByIdInAndOwnerUid(targetOrder.keySet(), uid);
        if (boards.size() != targetOrder.size()) {
            throw new RuntimeException("One or more boards do not belong to the current user.");
        }

        Map<Long, Board> byId = boards.stream()
                .collect(Collectors.toMap(Board::getId, b -> b));

        for (Map.Entry<Long, Integer> e : targetOrder.entrySet()) {
            Board b = byId.get(e.getKey());
            if (b != null) b.setPosition(e.getValue());
        }
        boardRepository.saveAll(boards);
    }

    /**
     * Deletes a board owned by the given UID and removes attachment folders for its tasks.
     *
     * @param uid owner UID
     * @param id  board id
     * @throws RuntimeException if the board does not exist or is not owned by the UID
     */
    public void deleteBoard(String uid, Long id) {
        Board board = boardRepository.findByIdAndOwnerUid(id, uid)
                .orElseThrow(() -> new RuntimeException("Board not found with id " + id));

        List<Long> taskIds = kanbanColumnRepository.findByBoardId(board.getId()).stream()
                .flatMap((KanbanColumn col) -> taskRepository.findByKanbanColumn(col).stream())
                .map(t -> t.getId())
                .toList();

        boardRepository.delete(board);
        taskIds.forEach(this::deleteTaskFolderQuiet);
    }

    /**
     * Returns whether the given board id is owned by the specified UID.
     *
     * @param uid     owner UID
     * @param boardId board id
     * @return {@code true} if owned, {@code false} otherwise
     */
    public boolean ownsBoard(String uid, Long boardId) {
        return boardRepository.findByIdAndOwnerUid(boardId, uid).isPresent();
    }

    // ---------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------

    /**
     * Initializes missing {@code position} values for the owner's boards, once per owner.
     * The initial order is derived from case-insensitive name ordering.
     *
     * @param uid owner UID
     */
    private void initPositionsIfMissing(String uid) {
        if (ownersWithPositionsInitialized.contains(uid)) return;

        synchronized (ownersWithPositionsInitialized) {
            if (ownersWithPositionsInitialized.contains(uid)) return;

            List<Board> all = boardRepository.findAllByOwnerUid(uid);
            boolean needsSave = all.stream().anyMatch(b -> b.getPosition() == null);
            if (!needsSave) {
                ownersWithPositionsInitialized.add(uid);
                return;
            }

            all.sort(Comparator.comparing(
                    Board::getName, Comparator.nullsLast(String::compareToIgnoreCase)));
            int idx = 0;
            for (Board b : all) {
                b.setPosition(idx++);
            }
            boardRepository.saveAll(all);
            ownersWithPositionsInitialized.add(uid);
        }
    }

    /**
     * Deletes the on-disk folder for a given task ID, ignoring any I/O errors.
     *
     * @param taskId task id whose upload directory should be removed
     */
    private void deleteTaskFolderQuiet(Long taskId) {
        try {
            FileSystemUtils.deleteRecursively(Path.of(uploadDir, String.valueOf(taskId)));
        } catch (Exception ignored) {
            // best-effort cleanup
        }
    }
}
