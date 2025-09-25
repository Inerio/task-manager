package com.inerio.taskmanager.realtime;

import java.io.IOException;
import java.time.Instant;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * In-memory hub for SSE connections.
 * - Global channel: per-owner UID (sidebar "boards.*" updates).
 * - Per-board channel: per boardId ("columns.changed" / "tasks.changed").
 *
 * Emits lightweight "dirty" events; clients refetch targeted resources.
 */
@Component
public class SseHub {

    /** Never-timeout emitters (we rely on server heartbeats + client auto-reconnect). */
    private static final long TIMEOUT_NEVER = 0L;

    /** ownerUid -> emitters (global/boards stream) */
    private final ConcurrentHashMap<String, CopyOnWriteArraySet<SseEmitter>> globalEmitters = new ConcurrentHashMap<>();

    /** boardId -> emitters (per-board stream) */
    private final ConcurrentHashMap<Long, CopyOnWriteArraySet<SseEmitter>> boardEmitters = new ConcurrentHashMap<>();

    // -------------------------------
    // Subscription API
    // -------------------------------

    public SseEmitter subscribeGlobal(String ownerUid) {
        final SseEmitter emitter = new SseEmitter(TIMEOUT_NEVER);
        final CopyOnWriteArraySet<SseEmitter> set =
                globalEmitters.computeIfAbsent(ownerUid, _k -> new CopyOnWriteArraySet<>());
        set.add(emitter);

        emitter.onCompletion(() -> set.remove(emitter));
        emitter.onTimeout(() -> set.remove(emitter));
        emitter.onError(_e -> set.remove(emitter));

        // Initial "ping" so client knows the stream is alive immediately.
        safeSend(emitter, "ping", "{\"ts\":\"" + Instant.now().toString() + "\"}");
        return emitter;
    }

    public SseEmitter subscribeBoard(long boardId) {
        final SseEmitter emitter = new SseEmitter(TIMEOUT_NEVER);
        final CopyOnWriteArraySet<SseEmitter> set =
                boardEmitters.computeIfAbsent(boardId, _k -> new CopyOnWriteArraySet<>());
        set.add(emitter);

        emitter.onCompletion(() -> set.remove(emitter));
        emitter.onTimeout(() -> set.remove(emitter));
        emitter.onError(_e -> set.remove(emitter));

        safeSend(emitter, "ping", "{\"ts\":\"" + Instant.now().toString() + "\"}");
        return emitter;
    }

    // -------------------------------
    // Broadcast API (called by services after successful mutations)
    // -------------------------------

    /** Notify the sidebar for a specific owner. Event types: boards.created|boards.updated|boards.deleted */
    public void emitBoards(String ownerUid, String type) {
        Set<SseEmitter> subs = globalEmitters.getOrDefault(ownerUid, new CopyOnWriteArraySet<>());
        if (subs.isEmpty()) return;

        final String payload = "{\"type\":\"" + type + "\",\"ts\":\"" + Instant.now().toString() + "\"}";
        for (SseEmitter s : subs) safeSend(s, type, payload);
    }

    /** Notify a board page subscribers. Event types: columns.changed|tasks.changed */
    public void emitBoard(long boardId, String type) {
        Set<SseEmitter> subs = boardEmitters.getOrDefault(boardId, new CopyOnWriteArraySet<>());
        if (subs.isEmpty()) return;

        final String payload = "{\"type\":\"" + type + "\",\"boardId\":" + boardId + ",\"ts\":\"" + Instant.now().toString() + "\"}";
        for (SseEmitter s : subs) safeSend(s, type, payload);
    }

    /* ------- Overloads to accept EventType directly (ergonomic) ------- */

    public void emitBoards(String ownerUid, EventType type) {
        emitBoards(ownerUid, type.wire());
    }

    public void emitBoard(long boardId, EventType type) {
        emitBoard(boardId, type.wire());
    }

    // -------------------------------
    // Heartbeats (keep connections alive across proxies)
    // -------------------------------

    /** Send a "ping" every 25s to all connections. */
    @Scheduled(fixedDelay = 25_000L)
    public void heartbeat() {
        final String payload = "{\"type\":\"ping\",\"ts\":\"" + Instant.now().toString() + "\"}";
        globalEmitters.values().forEach(set -> set.forEach(s -> safeSend(s, "ping", payload)));
        boardEmitters.values().forEach(set -> set.forEach(s -> safeSend(s, "ping", payload)));
    }

    // -------------------------------
    // Helpers
    // -------------------------------

    private void safeSend(SseEmitter emitter, String event, String jsonData) {
        try {
            SseEmitter.SseEventBuilder ev = SseEmitter.event()
                    .name(event)
                    .data(jsonData)
                    .reconnectTime(3000L);
            emitter.send(ev);
        } catch (IOException ex) {
            // Remove broken emitter immediately.
            emitter.completeWithError(ex);
        }
    }
}
