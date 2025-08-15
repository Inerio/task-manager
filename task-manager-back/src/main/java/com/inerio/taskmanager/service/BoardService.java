package com.inerio.taskmanager.service;

import com.inerio.taskmanager.config.AppProperties;
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
import org.springframework.stereotype.Service;
import org.springframework.util.FileSystemUtils;

/**
 * Service for managing Kanban boards and related data, scoped by an anonymous user UID.
 */
@Service
public class BoardService {

    private final BoardRepository boardRepository;
    private final KanbanColumnRepository kanbanColumnRepository;
    private final TaskRepository taskRepository;
    private final UserAccountService userAccountService;
    private final Path baseUploadDir;

    /** Tracks which owners have had their legacy null positions initialized. */
    private final Set<String> ownersWithPositionsInitialized =
            Collections.synchronizedSet(new HashSet<>());

    public BoardService(BoardRepository boardRepository,
                        KanbanColumnRepository kanbanColumnRepository,
                        TaskRepository taskRepository,
                        UserAccountService userAccountService,
                        AppProperties props) {
        this.boardRepository = boardRepository;
        this.kanbanColumnRepository = kanbanColumnRepository;
        this.taskRepository = taskRepository;
        this.userAccountService = userAccountService;
        this.baseUploadDir = Path.of(props.getUploadDir()).toAbsolutePath().normalize();
    }

    public List<Board> getAllBoards(String uid) {
        initPositionsIfMissing(uid);
        return boardRepository.findAllByOwnerUidOrderByPositionAscNullsLast(uid);
    }

    public Optional<Board> getBoardById(String uid, Long id) {
        return boardRepository.findByIdAndOwnerUid(id, uid);
    }

    public Board createBoard(String uid, Board board) {
        UserAccount owner = userAccountService.getOrCreate(uid);
        Integer max = boardRepository.findMaxPositionByOwnerUid(uid);
        int next = (max == null) ? 0 : (max + 1);
        board.setPosition(next);
        board.setOwner(owner);
        return boardRepository.save(board);
    }

    public Board updateBoard(String uid, Long id, Board updated) {
        Board existing = boardRepository.findByIdAndOwnerUid(id, uid)
                .orElseThrow(() -> new RuntimeException("Board not found with id " + id));
        existing.setName(updated.getName());
        return boardRepository.save(existing);
    }

    public void reorderBoards(String uid, List<BoardReorderDto> items) {
        if (items == null || items.isEmpty()) return;

        List<BoardReorderDto> ordered = items.stream()
                .sorted(Comparator.comparing(BoardReorderDto::getPosition)
                        .thenComparing(BoardReorderDto::getId))
                .toList();

        Map<Long, Integer> targetOrder = new LinkedHashMap<>();
        int idx = 0;
        for (BoardReorderDto dto : ordered) targetOrder.put(dto.getId(), idx++);

        List<Board> boards = boardRepository.findAllByIdInAndOwnerUid(targetOrder.keySet(), uid);
        if (boards.size() != targetOrder.size()) {
            throw new RuntimeException("One or more boards do not belong to the current user.");
        }

        Map<Long, Board> byId = boards.stream().collect(Collectors.toMap(Board::getId, b -> b));
        for (Map.Entry<Long, Integer> e : targetOrder.entrySet()) {
            Board b = byId.get(e.getKey());
            if (b != null) b.setPosition(e.getValue());
        }
        boardRepository.saveAll(boards);
    }

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

    public boolean ownsBoard(String uid, Long boardId) {
        return boardRepository.findByIdAndOwnerUid(boardId, uid).isPresent();
    }

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

            all.sort(Comparator.comparing(Board::getName, Comparator.nullsLast(String::compareToIgnoreCase)));
            int idx = 0;
            for (Board b : all) b.setPosition(idx++);
            boardRepository.saveAll(all);
            ownersWithPositionsInitialized.add(uid);
        }
    }

    private void deleteTaskFolderQuiet(Long taskId) {
        try {
            FileSystemUtils.deleteRecursively(baseUploadDir.resolve(String.valueOf(taskId)));
        } catch (Exception ignored) { }
    }
}
