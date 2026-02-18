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
import com.inerio.taskmanager.service.UserAccountService;

/**
 * REST endpoints for presence (who's online) and display name management.
 */
@RestController
@RequestMapping("/api/v1/presence")
public class PresenceController {

    private final SseHub hub;
    private final UserAccountService users;

    public PresenceController(SseHub hub, UserAccountService users) {
        this.hub = hub;
        this.users = users;
    }

    /** Returns the list of currently connected sessions for the caller's UID. */
    @GetMapping
    public ResponseEntity<List<SseHub.PresenceEntry>> getPresence(
            @RequestHeader("X-Client-Id") String uid) {
        return ResponseEntity.ok(hub.getPresence(uid));
    }

    /** Returns the display name stored in the DB for this UID. */
    @GetMapping("/me")
    public ResponseEntity<Map<String, String>> getMyName(
            @RequestHeader("X-Client-Id") String uid) {
        String name = users.getDisplayName(uid);
        return ResponseEntity.ok(Map.of("displayName", name != null ? name : ""));
    }

    /**
     * Sets the display name for the caller.
     * Persists to DB and updates in-memory presence for the given session.
     * Body: { "displayName": "...", "sessionId": "..." }
     */
    @PutMapping("/me")
    public ResponseEntity<Void> setMyName(
            @RequestHeader("X-Client-Id") String uid,
            @RequestBody Map<String, String> body) {
        String displayName = body.getOrDefault("displayName", "").trim();
        if (displayName.length() > 40) displayName = displayName.substring(0, 40);

        users.setDisplayName(uid, displayName);

        // Also update the in-memory SSE session name
        String sessionId = body.get("sessionId");
        if (sessionId != null && !sessionId.isBlank()) {
            hub.updateSessionDisplayName(sessionId, displayName);
        }

        return ResponseEntity.ok().build();
    }
}
