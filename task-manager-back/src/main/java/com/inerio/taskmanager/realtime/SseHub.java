package com.inerio.taskmanager.realtime;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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
 * - Presence tracking: who is currently connected for a given UID.
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

    // ---- Presence tracking ----

    /** Maps an SseEmitter to the session ID that opened it. */
    private final ConcurrentHashMap<SseEmitter, String> emitterToSession = new ConcurrentHashMap<>();

    /** Maps an SseEmitter to the owner UID it belongs to. */
    private final ConcurrentHashMap<SseEmitter, String> emitterToUid = new ConcurrentHashMap<>();

    /** Maps a session ID to the display name. */
    private final ConcurrentHashMap<String, String> sessionDisplayNames = new ConcurrentHashMap<>();

    /** Maps a session ID to the owner UID. */
    private final ConcurrentHashMap<String, String> sessionToUid = new ConcurrentHashMap<>();

    // -------------------------------
    // Subscription API
    // -------------------------------

    public SseEmitter subscribeGlobal(String ownerUid, String sessionId, String displayName) {
        final SseEmitter emitter = new SseEmitter(TIMEOUT_NEVER);
        final CopyOnWriteArraySet<SseEmitter> set =
                globalEmitters.computeIfAbsent(ownerUid, _k -> new CopyOnWriteArraySet<>());
        set.add(emitter);

        // Track presence
        emitterToSession.put(emitter, sessionId);
        emitterToUid.put(emitter, ownerUid);
        sessionToUid.put(sessionId, ownerUid);
        if (displayName != null && !displayName.isBlank()) {
            sessionDisplayNames.put(sessionId, displayName.trim());
        }

        Runnable cleanup = () -> {
            set.remove(emitter);
            emitterToSession.remove(emitter);
            emitterToUid.remove(emitter);
            // Broadcast presence change after disconnect
            emitPresence(ownerUid);
        };
        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError(_e -> cleanup.run());

        // Initial "ping" so client knows the stream is alive immediately.
        safeSend(emitter, "ping", "{\"ts\":\"" + Instant.now().toString() + "\"}");

        // Notify others about new presence
        emitPresence(ownerUid);

        return emitter;
    }

    /** Backward-compat overload without presence info. */
    public SseEmitter subscribeGlobal(String ownerUid) {
        return subscribeGlobal(ownerUid, "anon-" + System.nanoTime(), null);
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
    // Presence API
    // -------------------------------

    /** Returns the list of currently connected users for this UID. */
    public List<PresenceEntry> getPresence(String ownerUid) {
        Set<SseEmitter> subs = globalEmitters.getOrDefault(ownerUid, new CopyOnWriteArraySet<>());
        // Deduplicate by sessionId
        Map<String, String> seen = new ConcurrentHashMap<>();
        for (SseEmitter e : subs) {
            String sid = emitterToSession.get(e);
            if (sid != null) {
                seen.putIfAbsent(sid, sessionDisplayNames.getOrDefault(sid, ""));
            }
        }
        List<PresenceEntry> result = new ArrayList<>();
        for (Map.Entry<String, String> entry : seen.entrySet()) {
            result.add(new PresenceEntry(entry.getKey(), entry.getValue()));
        }
        return result;
    }

    /** Update the display name for a session. */
    public void updateSessionDisplayName(String sessionId, String displayName) {
        if (displayName != null && !displayName.isBlank()) {
            sessionDisplayNames.put(sessionId, displayName.trim());
        } else {
            sessionDisplayNames.remove(sessionId);
        }
        // Broadcast presence change to the UID this session belongs to
        String uid = sessionToUid.get(sessionId);
        if (uid != null) {
            emitPresence(uid);
        }
    }

    /** Broadcast a presence.changed event to all subscribers of a given UID. */
    public void emitPresence(String ownerUid) {
        Set<SseEmitter> subs = globalEmitters.getOrDefault(ownerUid, new CopyOnWriteArraySet<>());
        if (subs.isEmpty()) return;

        final String payload = "{\"type\":\"presence.changed\",\"ts\":\"" + Instant.now().toString() + "\"}";
        for (SseEmitter s : subs) safeSend(s, EventType.PRESENCE_CHANGED.wire(), payload);
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

    /** Simple DTO for presence info. */
    public record PresenceEntry(String sessionId, String displayName) {}
}
