package com.inerio.taskmanager.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;

import com.inerio.taskmanager.config.AppProperties;
import com.inerio.taskmanager.dto.TaskDto;
import com.inerio.taskmanager.dto.TaskReorderDto;
import com.inerio.taskmanager.model.KanbanColumn;
import com.inerio.taskmanager.model.Task;
import com.inerio.taskmanager.realtime.SseHub;
import com.inerio.taskmanager.repository.KanbanColumnRepository;
import com.inerio.taskmanager.repository.TaskRepository;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock TaskRepository taskRepository;
    @Mock KanbanColumnRepository kanbanColumnRepository;
    @Mock SseHub sse;

    @TempDir Path tmp;

    private TaskService service;

    @Captor ArgumentCaptor<List<Task>> listCaptor;

    @BeforeEach
    void setUp() {
        AppProperties props = new AppProperties();
        props.setUploadDir(tmp.toString());
        service = new TaskService(taskRepository, kanbanColumnRepository, props, sse);
    }

    private static void setId(Object entity, Long id) {
        try {
            Field f = entity.getClass().getDeclaredField("id");
            f.setAccessible(true);
            f.set(entity, id);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static Task task(Long id, int pos, KanbanColumn col) {
        Task t = new Task();
        t.setTitle("t-" + id);
        t.setPosition(pos);
        t.setKanbanColumn(col);
        setId(t, id);
        return t;
    }

    @Test
    @DisplayName("reorderTasks: bump+flush then write final order")
    void reorderTasks_nominal() {
        KanbanColumn col = new KanbanColumn();
        setId(col, 100L);
        Task t1 = task(1L, 0, col);
        Task t2 = task(2L, 1, col);
        Task t3 = task(3L, 2, col);

        when(taskRepository.findAllById(any())).thenReturn(List.of(t1, t2, t3));
        when(taskRepository.findByKanbanColumnOrderByPositionAscIdAsc(col))
                .thenReturn(List.of(t1, t2, t3));

        service.reorderTasks(List.of(
                new TaskReorderDto(1L, 2),
                new TaskReorderDto(2L, 0),
                new TaskReorderDto(3L, 1)
        ));

        assertThat(t1.getPosition()).isEqualTo(2);
        assertThat(t2.getPosition()).isEqualTo(0);
        assertThat(t3.getPosition()).isEqualTo(1);

        verify(taskRepository, times(2)).saveAll(anyList());
        verify(taskRepository, times(2)).flush();
    }

    @Test
    @DisplayName("reorderTasks: ignores unknown IDs (no exception)")
    void reorderTasks_ignoresUnknownIds() {
        KanbanColumn col = new KanbanColumn();
        setId(col, 200L);
        Task t1 = task(1L, 0, col);

        when(taskRepository.findAllById(any())).thenReturn(List.of(t1));
        when(taskRepository.findByKanbanColumnOrderByPositionAscIdAsc(col))
                .thenReturn(List.of(t1));

        assertThatCode(() -> service.reorderTasks(List.of(
                new TaskReorderDto(1L, 5),
                new TaskReorderDto(999L, 0)
        ))).doesNotThrowAnyException();

        verify(taskRepository, times(2)).saveAll(anyList());
        verify(taskRepository, times(2)).flush();
    }

    @Test
    @DisplayName("moveTask: changes column and appends at destination end")
    void moveTask_nominal() {
        KanbanColumn source = new KanbanColumn("S", 0);
        setId(source, 5L);

        KanbanColumn target = new KanbanColumn("T", 0);
        setId(target, 7L);

        Task t = task(42L, 3, source);

        when(taskRepository.findById(42L)).thenReturn(Optional.of(t));
        when(kanbanColumnRepository.findById(7L)).thenReturn(Optional.of(target));
        when(taskRepository.findByKanbanColumnOrderByPositionAsc(target)).thenReturn(List.of());
        when(taskRepository.findByKanbanColumnAndPositionGreaterThanOrderByPositionAsc(any(), anyInt()))
                .thenReturn(List.of());
        // stub local
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        service.moveTask(42L, 7L, 1);

        assertThat(t.getKanbanColumn()).isEqualTo(target);
        assertThat(t.getPosition()).isEqualTo(0);
        verify(taskRepository).save(t);
    }

    @Test
    @DisplayName("createTaskFromDto: appends at end of column (last + 1)")
    void createTaskFromDto_appends() {
        KanbanColumn col = new KanbanColumn("A", 0);
        setId(col, 10L);

        Task existing0 = task(100L, 0, col);
        Task existing1 = task(101L, 1, col);
        when(taskRepository.findByKanbanColumnOrderByPositionAsc(col))
                .thenReturn(List.of(existing0, existing1));
        // stub local
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        TaskDto dto = new TaskDto();
        dto.setTitle("New task");

        Task saved = service.createTaskFromDto(dto, col);

        assertThat(saved.getPosition()).isEqualTo(2);
        assertThat(saved.getKanbanColumn()).isEqualTo(col);
        verify(taskRepository).save(saved);
    }

    @Test
    @DisplayName("updateTaskFromDto: updates fields and saves")
    void updateTaskFromDto_updates() {
        KanbanColumn col = new KanbanColumn("A", 0);
        setId(col, 10L);

        Task existing = task(5L, 0, col);
        existing.setTitle("Old");
        existing.setDescription("Old desc");
        existing.setCompleted(false);

        when(taskRepository.findById(5L)).thenReturn(Optional.of(existing));
        // stub local
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        TaskDto dto = new TaskDto();
        dto.setTitle("New");
        dto.setDescription("New desc");
        dto.setCompleted(true);

        Task out = service.updateTaskFromDto(5L, dto, col);

        assertThat(out.getTitle()).isEqualTo("New");
        assertThat(out.getDescription()).isEqualTo("New desc");
        assertThat(out.isCompleted()).isTrue();
        assertThat(out.getKanbanColumn()).isEqualTo(col);
        verify(taskRepository).save(existing);
    }

    @Test
    @DisplayName("deleteTask: deletes and compacts positions > deletedPos")
    void deleteTask_compacts() {
        KanbanColumn col = new KanbanColumn("A", 0);
        setId(col, 1L);

        Task t1 = task(11L, 1, col);
        Task t2 = task(12L, 2, col);

        when(taskRepository.findById(11L)).thenReturn(Optional.of(t1));
        when(taskRepository.findByKanbanColumnAndPositionGreaterThanOrderByPositionAsc(col, 1))
                .thenReturn(List.of(t2));

        service.deleteTask(11L);

        verify(taskRepository).deleteById(11L);
        verify(taskRepository).saveAll(listCaptor.capture());
        assertThat(listCaptor.getValue()).containsExactly(t2);
        assertThat(t2.getPosition()).isEqualTo(1);
    }

    @Test
    @DisplayName("getTasksByKanbanColumnId: throws when column is missing")
    void getTasksByKanbanColumnId_missing() {
        when(kanbanColumnRepository.findById(404L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getTasksByKanbanColumnId(404L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("KanbanColumn not found");
    }

    @Test
    @DisplayName("uploadAttachment: writes to disk and updates DB")
    void uploadAttachment_ok() throws Exception {
        Task t = task(1L, 0, new KanbanColumn());
        when(taskRepository.findById(1L)).thenReturn(Optional.of(t));
        // stub local
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile file = new MockMultipartFile("file", "hello.txt", "text/plain", "hi".getBytes());

        Task updated = service.uploadAttachment(1L, file);

        Path expected = tmp.resolve("1").resolve("hello.txt");
        assertThat(Files.exists(expected)).isTrue();
        assertThat(updated.getAttachments()).contains("hello.txt");
        verify(taskRepository).save(t);
    }

    @Test
    @DisplayName("uploadAttachment: rejects invalid/traversal names")
    void uploadAttachment_traversal() {
        MockMultipartFile file = new MockMultipartFile("file", "../..", "text/plain", "x".getBytes());

        assertThatThrownBy(() -> service.uploadAttachment(3L, file))
                .isInstanceOf(IllegalArgumentException.class);

        verifyNoInteractions(taskRepository);
    }

    @Test
    @DisplayName("downloadAttachment: 200 with proper headers when file exists")
    void downloadAttachment_ok() throws Exception {
        Path dir = tmp.resolve("5");
        Files.createDirectories(dir);
        Path f = dir.resolve("a.txt");
        Files.writeString(f, "yo");

        ResponseEntity<Resource> resp = service.downloadAttachment(5L, "a.txt");
        assertThat(resp.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(resp.getHeaders().getFirst("Content-Disposition"))
                .contains("attachment; filename=\"a.txt\"");
        Resource body = Objects.requireNonNull(resp.getBody());
        assertThat(body.exists()).isTrue();
    }

    @Test
    @DisplayName("downloadAttachment: 404 if missing; 400 if invalid name")
    void downloadAttachment_404_and_400() {
        assertThat(service.downloadAttachment(6L, "missing.txt").getStatusCode().value())
                .isEqualTo(404);
        assertThat(service.downloadAttachment(6L, ".").getStatusCode().value())
                .isEqualTo(400);
    }

    @Test
    @DisplayName("deleteAttachment: deletes file and updates attachments")
    void deleteAttachment_ok() throws Exception {
        Task t = task(7L, 0, new KanbanColumn());
        t.getAttachments().add("del.txt");
        when(taskRepository.findById(7L)).thenReturn(Optional.of(t));
        // stub local
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        Path dir = tmp.resolve("7");
        Files.createDirectories(dir);
        Files.writeString(dir.resolve("del.txt"), "bye");

        Task out = service.deleteAttachment(7L, "del.txt");

        assertThat(Files.exists(dir.resolve("del.txt"))).isFalse();
        assertThat(out.getAttachments()).doesNotContain("del.txt");
        verify(taskRepository).save(t);
    }
}
