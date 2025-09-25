package com.inerio.taskmanager.service;

import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.inerio.taskmanager.config.AppProperties;
import com.inerio.taskmanager.dto.TaskDto;
import com.inerio.taskmanager.dto.TaskMapperDto;
import com.inerio.taskmanager.dto.TaskReorderDto;
import com.inerio.taskmanager.exception.TaskNotFoundException;
import com.inerio.taskmanager.model.KanbanColumn;
import com.inerio.taskmanager.model.Task;
import com.inerio.taskmanager.realtime.EventType;
import com.inerio.taskmanager.realtime.SseHub;
import com.inerio.taskmanager.repository.KanbanColumnRepository;
import com.inerio.taskmanager.repository.TaskRepository;

@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final KanbanColumnRepository kanbanColumnRepository;
    private final Path baseUploadDir;
    private final SseHub sse;

    public TaskService(TaskRepository taskRepository,
                       KanbanColumnRepository kanbanColumnRepository,
                       AppProperties appProperties,
                       SseHub sse) {
        this.taskRepository = taskRepository;
        this.kanbanColumnRepository = kanbanColumnRepository;
        this.baseUploadDir = Paths.get(appProperties.getUploadDir()).toAbsolutePath().normalize();
        this.sse = sse;
    }

    // ==============================
    //   OWNERSHIP HELPERS
    // ==============================

    @Transactional(readOnly = true)
    public boolean ownsColumn(String uid, Long columnId) {
        return kanbanColumnRepository.existsByIdAndBoardOwnerUid(columnId, uid);
    }

    @Transactional(readOnly = true)
    public boolean ownsTask(String uid, Long taskId) {
        return taskRepository.existsByIdAndKanbanColumnBoardOwnerUid(taskId, uid);
    }

    // ==============================
    //   TASK READ OPERATIONS
    // ==============================

    @Transactional(readOnly = true)
    public List<Task> getAllTasksForOwner(String uid) {
        return taskRepository.findAllForOwnerOrdered(uid);
    }

    @Transactional(readOnly = true)
    public Optional<Task> getTaskById(Long id) {
        return taskRepository.findById(id);
    }

    /**
     * Returns tasks for a column, ordered stably by (position ASC, id ASC).
     */
    @Transactional(readOnly = true)
    public List<Task> getTasksByKanbanColumnId(Long kanbanColumnId) {
        KanbanColumn kanbanColumn = kanbanColumnRepository.findById(kanbanColumnId)
            .orElseThrow(() -> new RuntimeException("KanbanColumn not found with ID " + kanbanColumnId));
        return taskRepository.findByKanbanColumnOrderByPositionAscIdAsc(kanbanColumn);
    }

    // ==============================
    //   TASK WRITE OPERATIONS
    // ==============================

    /**
     * Creates a task appended at the end of the target column.
     */
    @Transactional
    public Task createTaskFromDto(TaskDto dto, KanbanColumn kanbanColumn) {
        Task task = TaskMapperDto.toEntity(dto, kanbanColumn);
        int maxPosition = 0;
        List<Task> current = taskRepository.findByKanbanColumnOrderByPositionAsc(kanbanColumn);
        if (!current.isEmpty()) {
            maxPosition = current.get(current.size() - 1).getPosition() + 1;
        }
        task.setPosition(maxPosition);
        Task saved = taskRepository.save(task);

        if (kanbanColumn.getBoard() != null && kanbanColumn.getBoard().getId() != null) {
            sse.emitBoard(kanbanColumn.getBoard().getId(), EventType.TASKS_CHANGED);
        }

        return saved;
    }

    /**
     * If the column changes, place the task temporarily at the end of the destination
     * column (free position) and compact the source column. A subsequent /reorder will
     * assign the final dense order.
     */
    @Transactional
    public Task updateTaskFromDto(Long id, TaskDto dto, KanbanColumn targetColumn) {
        Task existing = taskRepository.findById(id)
            .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + id));

        // Business fields
        existing.setTitle(dto.getTitle());
        existing.setDescription(dto.getDescription());
        existing.setCompleted(dto.isCompleted());
        existing.setDueDate(dto.getDueDate());

        KanbanColumn sourceColumn = existing.getKanbanColumn();
        boolean columnChanged = sourceColumn != null
                && targetColumn != null
                && !sourceColumn.getId().equals(targetColumn.getId());

        Long srcBoardId = sourceColumn != null && sourceColumn.getBoard() != null ? sourceColumn.getBoard().getId() : null;
        Long dstBoardId = targetColumn != null && targetColumn.getBoard() != null ? targetColumn.getBoard().getId() : null;

        if (columnChanged) {
            int oldPos = existing.getPosition();

            // Append into destination column at a free position
            List<Task> dest = taskRepository.findByKanbanColumnOrderByPositionAsc(targetColumn);
            int appendPos = dest.isEmpty() ? 0 : dest.get(dest.size() - 1).getPosition() + 1;

            existing.setKanbanColumn(targetColumn);
            existing.setPosition(appendPos);

            // Compact source column (shift down all positions > oldPos)
            List<Task> toShift = taskRepository
                .findByKanbanColumnAndPositionGreaterThanOrderByPositionAsc(sourceColumn, oldPos);
            for (Task t : toShift) {
                t.setPosition(t.getPosition() - 1);
            }
            taskRepository.saveAll(toShift);
        } else {
            existing.setKanbanColumn(targetColumn);
        }

        Task saved = taskRepository.save(existing);

        if (srcBoardId != null) sse.emitBoard(srcBoardId, EventType.TASKS_CHANGED);
        if (dstBoardId != null && !dstBoardId.equals(srcBoardId)) {
            sse.emitBoard(dstBoardId, EventType.TASKS_CHANGED);
        }

        return saved;
    }

    @Transactional
    public void deleteTask(Long id) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + id));
        KanbanColumn kanbanColumn = task.getKanbanColumn();
        int deletedPos = task.getPosition();
        Long boardId = kanbanColumn != null && kanbanColumn.getBoard() != null ? kanbanColumn.getBoard().getId() : null;

        deleteAttachmentsFolder(id);
        taskRepository.deleteById(id);

        List<Task> toShift = taskRepository.findByKanbanColumnAndPositionGreaterThanOrderByPositionAsc(kanbanColumn, deletedPos);
        for (Task t : toShift) {
            t.setPosition(t.getPosition() - 1);
        }
        taskRepository.saveAll(toShift);

        if (boardId != null) sse.emitBoard(boardId, EventType.TASKS_CHANGED);
    }

    @Transactional
    public void deleteTasksByKanbanColumnId(Long kanbanColumnId) {
        KanbanColumn kanbanColumn = kanbanColumnRepository.findById(kanbanColumnId)
            .orElseThrow(() -> new RuntimeException("KanbanColumn not found with ID " + kanbanColumnId));
        Long boardId = kanbanColumn.getBoard() != null ? kanbanColumn.getBoard().getId() : null;

        List<Task> tasks = taskRepository.findByKanbanColumn(kanbanColumn);
        for (Task task : tasks) {
            deleteAttachmentsFolder(task.getId());
        }
        taskRepository.deleteAll(tasks);

        if (boardId != null) sse.emitBoard(boardId, EventType.TASKS_CHANGED);
    }

    @Transactional
    public void deleteTasksByBoardId(Long boardId) {
        kanbanColumnRepository.findByBoardId(boardId)
                .forEach(column -> deleteTasksByKanbanColumnId(column.getId()));
        sse.emitBoard(boardId, EventType.TASKS_CHANGED);
    }

    public void deleteAllTasks() {
        taskRepository.findAll().forEach(t -> deleteAttachmentsFolder(t.getId()));
        taskRepository.deleteAll();
    }

    // ==============================
    //   POSITION / REORDER LOGIC
    // ==============================

    /**
     * Ignore the requested position, append to the destination column, and compact the source.
     * The client will call /reorder to assign the final order.
     */
    @Transactional
    public void moveTask(Long taskId, Long targetKanbanColumnId, int _targetPositionIgnored) {
        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + taskId));
        KanbanColumn targetColumn = kanbanColumnRepository.findById(targetKanbanColumnId)
            .orElseThrow(() -> new RuntimeException("KanbanColumn not found with ID " + targetKanbanColumnId));

        KanbanColumn source = task.getKanbanColumn();
        Long srcBoardId = source != null && source.getBoard() != null ? source.getBoard().getId() : null;
        Long dstBoardId = targetColumn.getBoard() != null ? targetColumn.getBoard().getId() : null;

        boolean columnChanged = source == null || !source.getId().equals(targetColumn.getId());

        if (!columnChanged) {
            return;
        }

        int oldPos = task.getPosition();

        // Append into destination column at a free position
        List<Task> dest = taskRepository.findByKanbanColumnOrderByPositionAsc(targetColumn);
        int appendPos = dest.isEmpty() ? 0 : dest.get(dest.size() - 1).getPosition() + 1;

        task.setKanbanColumn(targetColumn);
        task.setPosition(appendPos);
        taskRepository.save(task);

        // Compact source column
        if (source != null) {
            List<Task> toShift = taskRepository
                .findByKanbanColumnAndPositionGreaterThanOrderByPositionAsc(source, oldPos);
            for (Task t : toShift) {
                t.setPosition(t.getPosition() - 1);
            }
            taskRepository.saveAll(toShift);
        }

        // Notify boards
        if (srcBoardId != null) sse.emitBoard(srcBoardId, EventType.TASKS_CHANGED);
        if (dstBoardId != null && !dstBoardId.equals(srcBoardId)) {
            sse.emitBoard(dstBoardId, EventType.TASKS_CHANGED);
        }
    }

    /**
     * Two-phase reorder per affected column to respect the unique constraint (kanban_column_id, position).
     * Phase 1: bump all tasks in the column to a high temporary range to free final positions.
     * Phase 2: assign final dense positions 0..n-1 based on client intent, with id as tie-breaker.
     */
    @Transactional
    public void reorderTasks(List<TaskReorderDto> reorderedTasks) {
        if (reorderedTasks == null || reorderedTasks.isEmpty()) return;

        final int BUMP = 100_000;

        // Client-provided target positions
        var targetPos = new java.util.HashMap<Long, Integer>(reorderedTasks.size());
        for (TaskReorderDto dto : reorderedTasks) {
            targetPos.put(dto.getId(), dto.getPosition());
        }

        // Identify affected columns from the touched tasks
        List<Task> touched = taskRepository.findAllById(targetPos.keySet());
        if (touched.isEmpty()) return;

        var colToEntity = new java.util.HashMap<Long, KanbanColumn>();
        for (Task t : touched) {
            KanbanColumn c = t.getKanbanColumn();
            if (c != null) colToEntity.putIfAbsent(c.getId(), c);
        }

        // Track boards to notify at the end
        Set<Long> boardsTouched = new HashSet<>();

        for (var entry : colToEntity.entrySet()) {
            KanbanColumn column = entry.getValue();

            // Load the full set of tasks for this column (not only the touched ones)
            List<Task> allInColumn = taskRepository.findByKanbanColumnOrderByPositionAscIdAsc(column);
            if (allInColumn.isEmpty()) continue;

            // Current positions snapshot for fallback
            var curPos = new java.util.HashMap<Long, Integer>(allInColumn.size());
            for (Task t : allInColumn) curPos.put(t.getId(), t.getPosition());

            // Compute final order based on client target positions (fallback to current),
            // with id as stable tie-breaker
            java.util.List<Task> ordered = new java.util.ArrayList<>(allInColumn);
            ordered.sort((a, b) -> {
                int pa = targetPos.getOrDefault(a.getId(), curPos.get(a.getId()));
                int pb = targetPos.getOrDefault(b.getId(), curPos.get(b.getId()));
                int c = Integer.compare(pa, pb);
                return (c != 0) ? c : Long.compare(a.getId(), b.getId());
            });

            // Phase 1: bump positions to free the final range
            for (Task t : allInColumn) t.setPosition(t.getPosition() + BUMP);
            taskRepository.saveAll(allInColumn);
            taskRepository.flush(); // ensure uniqueness at this step

            // Phase 2: assign final dense positions
            for (int i = 0; i < ordered.size(); i++) ordered.get(i).setPosition(i);
            taskRepository.saveAll(ordered);
            taskRepository.flush();

            // Mark board for notification
            if (column.getBoard() != null && column.getBoard().getId() != null) {
                boardsTouched.add(column.getBoard().getId());
            }
        }

        // Notify affected boards once per board
        for (Long bId : boardsTouched) {
            sse.emitBoard(bId, EventType.TASKS_CHANGED);
        }
    }

    // ==============================
    //   ATTACHMENT MANAGEMENT
    // ==============================

    public Task uploadAttachment(Long taskId, MultipartFile file) throws Exception {
        Path uploadPath = baseUploadDir.resolve(taskId.toString()).normalize();
        Files.createDirectories(uploadPath);

        String original = file.getOriginalFilename();
        if (original == null || original.isBlank()) throw new IllegalArgumentException("Invalid filename");

        String safeName = sanitizeFilename(original);
        Path filePath = uploadPath.resolve(safeName).normalize();

        // Prevent path traversal
        if (!filePath.toAbsolutePath().startsWith(uploadPath.toAbsolutePath())) {
            throw new IllegalArgumentException("Invalid filename");
        }

        synchronized (this) {
            Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + taskId));

            if (task.getAttachments().contains(safeName)) {
                throw new IllegalStateException("Attachment already exists: " + safeName);
            }
            if (Files.exists(filePath)) {
                throw new IllegalStateException("A file with this name already exists on the server: " + safeName);
            }

            try (var in = file.getInputStream()) {
                Files.copy(in, filePath);
            }
            task.getAttachments().add(safeName);
            taskRepository.save(task);
            return task;
        }
    }

    public ResponseEntity<Resource> downloadAttachment(Long taskId, String filename) {
        try {
            String safeName = sanitizeFilename(filename);
            Path file = baseUploadDir.resolve(Paths.get(taskId.toString(), safeName)).normalize();
            Resource resource = new UrlResource(file.toUri());
            if (!resource.exists()) return ResponseEntity.notFound().build();

            MediaType mediaType = MediaTypeFactory.getMediaType(resource)
                .orElse(MediaType.APPLICATION_OCTET_STREAM);

            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + safeName + "\"")
                .contentType(mediaType)
                .body(resource);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    public Task deleteAttachment(Long taskId, String filename) {
        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + taskId));
        String safeName = sanitizeFilename(filename);
        Path filePath = baseUploadDir.resolve(Paths.get(taskId.toString(), safeName)).normalize();
        try {
            Files.deleteIfExists(filePath);
            task.getAttachments().remove(safeName);
            taskRepository.save(task);
            Path dirPath = baseUploadDir.resolve(taskId.toString());
            try (DirectoryStream<Path> s = Files.newDirectoryStream(dirPath)) {
                if (!s.iterator().hasNext()) Files.deleteIfExists(dirPath);
            }
        } catch (Exception ignored) {
        }
        return task;
    }

    @Transactional
    public Task deleteAllAttachments(Long taskId) {
        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + taskId));

        deleteAttachmentsFolder(taskId);

        task.getAttachments().clear();
        return taskRepository.save(task);
    }

    private void deleteAttachmentsFolder(Long taskId) {
        Path taskUploadDir = baseUploadDir.resolve(taskId.toString()).normalize();
        try (var walk = Files.walk(taskUploadDir)) {
            walk.sorted(Comparator.reverseOrder())
                .forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (Exception ignored) { }
                });
        } catch (Exception ignored) { }
    }

    private static String sanitizeFilename(String name) {
        String base = Paths.get(name).getFileName().toString();
        base = base.replaceAll("[\\r\\n\\t]", "_");
        base = base.replaceAll("[^A-Za-z0-9._-]", "_");
        if (base.length() > 255) base = base.substring(0, 255);
        if (base.equals(".") || base.equals("..") || base.isBlank()) throw new IllegalArgumentException("Invalid filename");
        return base;
    }
}
