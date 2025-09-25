package com.inerio.taskmanager.realtime;

/**
 * Stable event vocabulary for the SSE protocol.
 * wire() returns the exact name used on the wire for EventSource listeners.
 */
public enum EventType {
    BOARDS_CREATED("boards.created"),
    BOARDS_UPDATED("boards.updated"),
    BOARDS_DELETED("boards.deleted"),
    COLUMNS_CHANGED("columns.changed"),
    TASKS_CHANGED("tasks.changed"),
    PING("ping");

    private final String wireName;

    EventType(String wireName) {
        this.wireName = wireName;
    }

    /** The exact event name clients subscribe to (EventSource.addEventListener). */
    public String wire() {
        return wireName;
    }
}
