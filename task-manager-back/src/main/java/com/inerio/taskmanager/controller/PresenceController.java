package com.inerio.taskmanager.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.inerio.taskmanager.realtime.SseHub;

/**
 * REST endpoints for presence (who's online) and display name management.
 * Display names are purely in-memory (tracked per SSE session in SseHub),
 * never persisted to the database — each browser keeps its own name in localStorage.
 */
@RestController
@RequestMapping("/api/v1/presence")
public class PresenceController {

    private static final int MAX_DISPLAY_NAME_LENGTH = 40;

    private final SseHub hub;

    public PresenceController(SseHub hub) {
        this.hub = hub;
    }

    /** Returns the list of currently connected sessions for the caller's UID. */
    @GetMapping
    public ResponseEntity<List<SseHub.PresenceEntry>> getPresence(
            @RequestHeader("X-Client-Id") String uid) {
        return ResponseEntity.ok(hub.getPresence(uid));
    }

    /**
     * Updates the display name for a given SSE session (in-memory only).
     * Body: { "displayName": "...", "sessionId": "..." }
     */
    @PutMapping("/me")
    public ResponseEntity<Void> setMyName(
            @RequestHeader("X-Client-Id") String uid,
            @RequestBody Map<String, String> body) {
        String displayName = body.getOrDefault("displayName", "").trim();
        if (displayName.length() > MAX_DISPLAY_NAME_LENGTH) displayName = displayName.substring(0, MAX_DISPLAY_NAME_LENGTH);

        String sessionId = body.get("sessionId");
        if (sessionId != null && !sessionId.isBlank()) {
            hub.updateSessionDisplayName(sessionId, displayName);
        }

        return ResponseEntity.ok().build();
    }
}
