package com.inerio.taskmanager.service;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import com.inerio.taskmanager.exception.ColumnNotFoundException;
import com.inerio.taskmanager.exception.TaskNotFoundException;
import com.inerio.taskmanager.model.KanbanColumn;
import com.inerio.taskmanager.model.Task;
import com.inerio.taskmanager.realtime.SseHub;
import com.inerio.taskmanager.repository.KanbanColumnRepository;
import com.inerio.taskmanager.repository.TaskRepository;
import com.inerio.taskmanager.realtime.EventType;

@Service
public class TaskService {

    private static final Logger log = LoggerFactory.getLogger(TaskService.class);
    private static final int POSITION_BUMP = 100_000;
    private static final int MAX_FILENAME_LENGTH = 255;

    /** Allowed MIME types for file uploads. */
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp", "image/svg+xml",
            "application/pdf",
            "text/plain", "text/csv",
            "application/json",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/zip", "application/gzip"
    );

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
        this.baseUploadDir = Path.of(appProperties.getUploadDir()).toAbsolutePath().normalize();
        this.sse = sse;
    }

    @Transactional(readOnly = true)
    public boolean ownsColumn(String uid, Long columnId) {
        return kanbanColumnRepository.existsByIdAndBoardOwnerUid(columnId, uid);
    }

    @Transactional(readOnly = true)
    public boolean ownsTask(String uid, Long taskId) {
        return taskRepository.existsByIdAndKanbanColumnBoardOwnerUid(taskId, uid);
    }

    @Transactional(readOnly = true)
    public List<Task> getAllTasksForOwner(String uid) {
        return taskRepository.findAllForOwnerOrdered(uid);
    }

    @Transactional(readOnly = true)
    public Optional<Task> getTaskById(Long id) {
        return taskRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public List<Task> getTasksByKanbanColumnId(Long kanbanColumnId) {
        KanbanColumn kanbanColumn = kanbanColumnRepository.findById(kanbanColumnId)
            .orElseThrow(() -> new ColumnNotFoundException("KanbanColumn not found with ID " + kanbanColumnId));
        return taskRepository.findByKanbanColumnOrderByPositionAscIdAsc(kanbanColumn);
    }

    @Transactional
    public Task createTaskFromDto(TaskDto dto, KanbanColumn kanbanColumn) {
        Task task = TaskMapperDto.toEntity(dto, kanbanColumn);
        int nextPosition = taskRepository.findMaxPositionByKanbanColumn(kanbanColumn)
                .map(max -> max + 1)
                .orElse(0);
        task.setPosition(nextPosition);
        Task saved = taskRepository.save(task);

        if (kanbanColumn.getBoard() != null && kanbanColumn.getBoard().getId() != null) {
            sse.emitBoard(kanbanColumn.getBoard().getId(), EventType.TASKS_CHANGED);
        }

        return saved;
    }

    @Transactional
    public Task updateTaskFromDto(Long id, TaskDto dto, KanbanColumn targetColumn) {
        Task existing = taskRepository.findById(id)
            .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + id));

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

            List<Task> dest = taskRepository.findByKanbanColumnOrderByPositionAsc(targetColumn);
            int appendPos = dest.isEmpty() ? 0 : dest.get(dest.size() - 1).getPosition() + 1;

            existing.setKanbanColumn(targetColumn);
            existing.setPosition(appendPos);

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
            .orElseThrow(() -> new ColumnNotFoundException("KanbanColumn not found with ID " + kanbanColumnId));
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

    @Transactional
    public void deleteAllTasksForOwner(String uid) {
        List<Task> tasks = taskRepository.findAllByOwnerUid(uid);
        Set<Long> boardIds = new HashSet<>();
        for (Task t : tasks) {
            deleteAttachmentsFolder(t.getId());
            if (t.getKanbanColumn() != null && t.getKanbanColumn().getBoard() != null) {
                boardIds.add(t.getKanbanColumn().getBoard().getId());
            }
        }
        taskRepository.deleteAll(tasks);
        for (Long boardId : boardIds) {
            sse.emitBoard(boardId, EventType.TASKS_CHANGED);
        }
    }

    @Transactional
    public void moveTask(Long taskId, Long targetKanbanColumnId, int targetPosition) {
        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + taskId));
        KanbanColumn targetColumn = kanbanColumnRepository.findById(targetKanbanColumnId)
            .orElseThrow(() -> new ColumnNotFoundException("KanbanColumn not found with ID " + targetKanbanColumnId));

        KanbanColumn source = task.getKanbanColumn();
        Long srcBoardId = source != null && source.getBoard() != null ? source.getBoard().getId() : null;
        Long dstBoardId = targetColumn.getBoard() != null ? targetColumn.getBoard().getId() : null;

        boolean columnChanged = source == null || !source.getId().equals(targetColumn.getId());

        if (!columnChanged) {
            return;
        }

        int oldPos = task.getPosition();

        List<Task> dest = taskRepository.findByKanbanColumnOrderByPositionAsc(targetColumn);
        int appendPos = dest.isEmpty() ? 0 : dest.get(dest.size() - 1).getPosition() + 1;

        task.setKanbanColumn(targetColumn);
        task.setPosition(appendPos);
        taskRepository.save(task);

        if (source != null) {
            List<Task> toShift = taskRepository
                .findByKanbanColumnAndPositionGreaterThanOrderByPositionAsc(source, oldPos);
            for (Task t : toShift) {
                t.setPosition(t.getPosition() - 1);
            }
            taskRepository.saveAll(toShift);
        }

        if (srcBoardId != null) sse.emitBoard(srcBoardId, EventType.TASKS_CHANGED);
        if (dstBoardId != null && !dstBoardId.equals(srcBoardId)) {
            sse.emitBoard(dstBoardId, EventType.TASKS_CHANGED);
        }
    }

    @Transactional
    public void reorderTasks(List<TaskReorderDto> reorderedTasks) {
        if (reorderedTasks == null || reorderedTasks.isEmpty()) return;

        Map<Long, Integer> targetPos = new HashMap<>(reorderedTasks.size());
        for (TaskReorderDto dto : reorderedTasks) {
            targetPos.put(dto.getId(), dto.getPosition());
        }

        List<Task> touched = taskRepository.findAllById(targetPos.keySet());
        if (touched.isEmpty()) return;

        Map<Long, KanbanColumn> colToEntity = new HashMap<>();
        for (Task t : touched) {
            KanbanColumn c = t.getKanbanColumn();
            if (c != null) colToEntity.putIfAbsent(c.getId(), c);
        }

        Set<Long> boardsTouched = new HashSet<>();

        for (var entry : colToEntity.entrySet()) {
            KanbanColumn column = entry.getValue();

            List<Task> allInColumn = taskRepository.findByKanbanColumnOrderByPositionAscIdAsc(column);
            if (allInColumn.isEmpty()) continue;

            Map<Long, Integer> curPos = new HashMap<>(allInColumn.size());
            for (Task t : allInColumn) curPos.put(t.getId(), t.getPosition());

            List<Task> ordered = new ArrayList<>(allInColumn);
            ordered.sort((a, b) -> {
                int pa = targetPos.getOrDefault(a.getId(), curPos.get(a.getId()));
                int pb = targetPos.getOrDefault(b.getId(), curPos.get(b.getId()));
                int c = Integer.compare(pa, pb);
                return (c != 0) ? c : Long.compare(a.getId(), b.getId());
            });

            for (Task t : allInColumn) t.setPosition(t.getPosition() + POSITION_BUMP);
            taskRepository.saveAll(allInColumn);
            taskRepository.flush();

            for (int i = 0; i < ordered.size(); i++) ordered.get(i).setPosition(i);
            taskRepository.saveAll(ordered);
            taskRepository.flush();

            if (column.getBoard() != null && column.getBoard().getId() != null) {
                boardsTouched.add(column.getBoard().getId());
            }
        }

        for (Long bId : boardsTouched) {
            sse.emitBoard(bId, EventType.TASKS_CHANGED);
        }
    }

    public Task uploadAttachment(Long taskId, MultipartFile file) {
        Path uploadPath = baseUploadDir.resolve(taskId.toString()).normalize();
        try { Files.createDirectories(uploadPath); } catch (IOException e) {
            throw new RuntimeException("Failed to create upload directory", e);
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_MIME_TYPES.contains(contentType.toLowerCase())) {
            throw new IllegalArgumentException("File type not allowed");
        }

        String original = file.getOriginalFilename();
        if (original == null || original.isBlank()) throw new IllegalArgumentException("Invalid filename");

        String safeName = sanitizeFilename(original);
        Path filePath = uploadPath.resolve(safeName).normalize();

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
            } catch (IOException e) {
                throw new RuntimeException("Failed to save uploaded file", e);
            }
            task.getAttachments().add(safeName);
            Task saved = taskRepository.save(task);

            Long boardId = (task.getKanbanColumn() != null && task.getKanbanColumn().getBoard() != null)
                    ? task.getKanbanColumn().getBoard().getId()
                    : null;
            if (boardId != null) sse.emitBoard(boardId, EventType.TASKS_CHANGED);

            return saved;
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

        Long boardId = (task.getKanbanColumn() != null && task.getKanbanColumn().getBoard() != null)
                ? task.getKanbanColumn().getBoard().getId()
                : null;

        try {
            Files.deleteIfExists(filePath);
            task.getAttachments().remove(safeName);
            Task saved = taskRepository.save(task);
            Path dirPath = baseUploadDir.resolve(taskId.toString());
            try (DirectoryStream<Path> s = Files.newDirectoryStream(dirPath)) {
                if (!s.iterator().hasNext()) Files.deleteIfExists(dirPath);
            }
            if (boardId != null) sse.emitBoard(boardId, EventType.TASKS_CHANGED);
            return saved;
        } catch (Exception e) {
            log.warn("Failed to delete attachment file '{}' for task {}", filename, taskId, e);
            return task;
        }
    }

    @Transactional
    public Task deleteAllAttachments(Long taskId) {
        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + taskId));

        Long boardId = (task.getKanbanColumn() != null && task.getKanbanColumn().getBoard() != null)
                ? task.getKanbanColumn().getBoard().getId()
                : null;

        deleteAttachmentsFolder(taskId);

        task.getAttachments().clear();
        Task saved = taskRepository.save(task);

        if (boardId != null) sse.emitBoard(boardId, EventType.TASKS_CHANGED);
        return saved;
    }

    private void deleteAttachmentsFolder(Long taskId) {
        Path taskUploadDir = baseUploadDir.resolve(taskId.toString()).normalize();
        try (var walk = Files.walk(taskUploadDir)) {
            walk.sorted(Comparator.reverseOrder())
                .forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (Exception e) {
                        log.debug("Could not delete path {}: {}", path, e.getMessage());
                    }
                });
        } catch (Exception e) {
            log.debug("Could not walk upload dir for task {}: {}", taskId, e.getMessage());
        }
    }

    private static String sanitizeFilename(String name) {
        String base = Paths.get(name).getFileName().toString();
        base = base.replaceAll("[\\r\\n\\t]", "_");
        base = base.replaceAll("[^A-Za-z0-9._-]", "_");
        if (base.length() > MAX_FILENAME_LENGTH) base = base.substring(0, MAX_FILENAME_LENGTH);
        if (base.equals(".") || base.equals("..") || base.isBlank()) throw new IllegalArgumentException("Invalid filename");
        return base;
    }
}
