package com.inerio.taskmanager.realtime;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

/**
 * Centralized, compact JSON serialization for SSE events.
 * Keeps wire format consistent and testable.
 */
@Component
public class EventJson {
    private final ObjectMapper mapper;

    public EventJson(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public String toJson(SseEvent e) {
        ObjectNode node = mapper.createObjectNode();
        node.put("type", e.getType().wire());
        node.put("ts", e.getTs().toString());
        if (e.getBoardId() != null) node.put("boardId", e.getBoardId());
        return node.toString();
    }
}
