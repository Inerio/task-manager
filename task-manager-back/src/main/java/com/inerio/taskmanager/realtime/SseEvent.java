package com.inerio.taskmanager.realtime;

import java.time.Instant;

/**
 * Minimal SSE event payload ("dirty" signal).
 * Clients refetch targeted resources upon reception.
 */
public class SseEvent {
    private final EventType type;
    private final Long boardId;
    private final Instant ts;

    public SseEvent(EventType type, Long boardId, Instant ts) {
        this.type = type;
        this.boardId = boardId;
        this.ts = ts != null ? ts : Instant.now();
    }

    public static SseEvent of(EventType type) {
        return new SseEvent(type, null, Instant.now());
    }

    public static SseEvent ofBoard(EventType type, long boardId) {
        return new SseEvent(type, boardId, Instant.now());
    }

    public EventType getType() { return type; }
    public Long getBoardId() { return boardId; }
    public Instant getTs() { return ts; }
}
