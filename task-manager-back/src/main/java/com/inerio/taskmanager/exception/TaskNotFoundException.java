package com.inerio.taskmanager.exception;

/**
 * Runtime exception indicating that a requested {@code Task} was not found.
 * Intended for use in service/business layers to surface a 404-like condition.
 */
public class TaskNotFoundException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /**
     * Creates a new exception with a detail message.
     *
     * @param message detail message describing the missing task
     */
    public TaskNotFoundException(String message) {
        super(message);
    }

    /**
     * Creates a new exception with a detail message and a cause.
     *
     * @param message detail message describing the missing task
     * @param cause   underlying cause
     */
    public TaskNotFoundException(String message, Throwable cause) {
        super(message, cause);
    }
}
