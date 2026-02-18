package com.inerio.taskmanager.exception;

/**
 * Runtime exception indicating that a requested {@code KanbanColumn} was not found.
 */
public class ColumnNotFoundException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public ColumnNotFoundException(String message) {
        super(message);
    }

    public ColumnNotFoundException(String message, Throwable cause) {
        super(message, cause);
    }
}
