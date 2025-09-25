package com.inerio.taskmanager.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.inerio.taskmanager.dto.TaskDto;
import com.inerio.taskmanager.model.KanbanColumn;
import com.inerio.taskmanager.model.Task;
import com.inerio.taskmanager.service.BoardService;
import com.inerio.taskmanager.service.KanbanColumnService;
import com.inerio.taskmanager.service.TaskService;
import com.inerio.taskmanager.service.UserAccountService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.net.URI;
import java.util.Optional;

import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = TaskController.class)
@Import(TaskControllerMvcTest.MockConfig.class)
class TaskControllerMvcTest {

    @TestConfiguration
    static class MockConfig {
        @Bean TaskService taskService() { return mock(TaskService.class); }
        @Bean KanbanColumnService kanbanColumnService() { return mock(KanbanColumnService.class); }
        @Bean UserAccountService userAccountService() { return mock(UserAccountService.class); }
        @Bean BoardService boardService() { return mock(BoardService.class); }
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;

    @Autowired TaskService taskService;
    @Autowired KanbanColumnService kanbanColumnService;
    @Autowired UserAccountService userAccountService;
    @Autowired BoardService boardService;

    @AfterEach
    void resetMocks() {
        reset(taskService, kanbanColumnService, userAccountService, boardService);
    }

    private static final String UID = "e2e-smoke-uid";
    private static final String BASE = "/api/v1/tasks";

    @Test
    @DisplayName("POST /api/v1/tasks -> 201 Created + JSON body (happy path)")
    void createTask_created201_withBody() throws Exception {
        TaskDto req = new TaskDto();
        req.setTitle("Hello world");
        req.setKanbanColumnId(10L);

        KanbanColumn col = new KanbanColumn();
        col.setId(10L);

        given(taskService.ownsColumn(UID, 10L)).willReturn(true);
        given(kanbanColumnService.getKanbanColumnById(10L)).willReturn(Optional.of(col));

        Task saved = new Task();
        saved.setTitle("Hello world");
        saved.setKanbanColumn(col);
        saved.setPosition(0);
        var idField = Task.class.getDeclaredField("id");
        idField.setAccessible(true);
        idField.set(saved, 123L);

        given(taskService.createTaskFromDto(any(TaskDto.class), eq(col))).willReturn(saved);

        mvc.perform(post(BASE)
                .header("X-Client-Id", UID)
                .contentType(MediaType.APPLICATION_JSON)
                .content(om.writeValueAsString(req)))
           .andExpect(status().isCreated())
           .andExpect(header().string("Location", is(URI.create("/123").toString())))
           .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
           .andExpect(jsonPath("$.id", is(123)))
           .andExpect(jsonPath("$.title", is("Hello world")))
           .andExpect(jsonPath("$.kanbanColumnId", is(10)))
           .andExpect(jsonPath("$.position", is(0)));

        verify(userAccountService).touch(UID);
        verify(taskService).ownsColumn(UID, 10L);
        ArgumentCaptor<TaskDto> dtoCap = ArgumentCaptor.forClass(TaskDto.class);
        verify(taskService).createTaskFromDto(dtoCap.capture(), eq(col));
        verify(kanbanColumnService).getKanbanColumnById(10L);
        verifyNoMoreInteractions(taskService, kanbanColumnService, userAccountService);
        verifyNoInteractions(boardService);
    }

    @Test
    @DisplayName("POST /api/v1/tasks -> 404 when column is not owned by UID")
    void createTask_404_whenNotOwner() throws Exception {
        String reqJson = """
          { "title": "X", "kanbanColumnId": 42 }
        """;

        given(taskService.ownsColumn(UID, 42L)).willReturn(false);

        mvc.perform(post(BASE)
                .header("X-Client-Id", UID)
                .contentType(MediaType.APPLICATION_JSON)
                .content(reqJson))
           .andExpect(status().isNotFound());

        verify(userAccountService).touch(UID);
        verify(taskService).ownsColumn(UID, 42L);
        verify(taskService, never()).createTaskFromDto(any(), any());
        verifyNoInteractions(kanbanColumnService, boardService);
        verifyNoMoreInteractions(taskService, userAccountService);
    }

    @Test
    @DisplayName("POST /api/v1/tasks -> 400 when target column does not exist")
    void createTask_400_whenColumnMissing() throws Exception {
        String reqJson = """
          { "title": "X", "kanbanColumnId": 77 }
        """;

        given(taskService.ownsColumn(UID, 77L)).willReturn(true);
        given(kanbanColumnService.getKanbanColumnById(77L)).willReturn(Optional.empty());

        mvc.perform(post(BASE)
                .header("X-Client-Id", UID)
                .contentType(MediaType.APPLICATION_JSON)
                .content(reqJson))
           .andExpect(status().isBadRequest());

        verify(userAccountService).touch(UID);
        verify(taskService).ownsColumn(UID, 77L);
        verify(kanbanColumnService).getKanbanColumnById(77L);
        verify(taskService, never()).createTaskFromDto(any(), any());
        verifyNoMoreInteractions(taskService, kanbanColumnService, userAccountService);
        verifyNoInteractions(boardService);
    }
}
