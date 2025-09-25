package com.inerio.taskmanager.controller;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.Nullable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.inerio.taskmanager.realtime.SseHub;
import com.inerio.taskmanager.service.BoardService;
import com.inerio.taskmanager.service.UserAccountService;

/**
 * SSE endpoints:
 * - /api/v1/events?uid=...              (global events: boards.*)
 * - /api/v1/events/board/{boardId}?uid=...(board-scoped: columns.changed, tasks.changed)
 *
 * Note: EventSource can't set custom headers; we accept UID via ?uid=
 * (fallback to X-Client-Id if present—useful for tests/tools).
 */
@RestController
@RequestMapping("/api/v1/events")
public class EventsController {

    private final SseHub hub;
    private final UserAccountService users;
    private final BoardService boards;

    public EventsController(SseHub hub, UserAccountService users, BoardService boards) {
        this.hub = hub;
        this.users = users;
        this.boards = boards;
    }

    @GetMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> subscribeGlobal(
            @RequestParam(name = "uid", required = false) @Nullable String uidParam,
            @RequestHeader(name = "X-Client-Id", required = false) @Nullable String uidHeader) {
        String uid = (uidParam != null && !uidParam.isBlank()) ? uidParam : uidHeader;
        if (uid == null || uid.isBlank()) return ResponseEntity.badRequest().build();
        users.touch(uid);
        return ResponseEntity.ok(hub.subscribeGlobal(uid));
    }

    @GetMapping(value = "/board/{boardId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> subscribeBoard(
            @PathVariable Long boardId,
            @RequestParam(name = "uid", required = false) @Nullable String uidParam,
            @RequestHeader(name = "X-Client-Id", required = false) @Nullable String uidHeader) {
        String uid = (uidParam != null && !uidParam.isBlank()) ? uidParam : uidHeader;
        if (uid != null && !boards.ownsBoard(uid, boardId)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(hub.subscribeBoard(boardId));
    }
}
