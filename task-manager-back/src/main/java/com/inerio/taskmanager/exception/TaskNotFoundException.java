package com.inerio.taskmanager.exception;

/**
 * Exception thrown when a Task entity with a given ID does not exist.
 * <p>
 * This custom exception is used in the service layer to signal that a
 * requested {@code Task} resource could not be found in the database.
 * It is typically mapped to a HTTP 404 (Not Found) response by a global
 * exception handler (see {@link org.springframework.web.bind.annotation.ControllerAdvice}).
 * </p>
 *
 * Usage example:
 * <pre>
 *     taskRepository.findById(id)
 *         .orElseThrow(() -> new TaskNotFoundException("Task not found with ID " + id));
 * </pre>
 */
public class TaskNotFoundException extends RuntimeException {

    /** Serial version UID for serialization. */
    private static final long serialVersionUID = 1L;

    /**
     * Constructs a new {@code TaskNotFoundException} with the specified detail message.
     *
     * @param message The detail message (can be shown in API error response)
     */
    public TaskNotFoundException(String message) {
        super(message);
    }

    /**
     * Constructs a new {@code TaskNotFoundException} with the specified message and cause.
     *
     * @param message The detail message
     * @param cause The cause of this exception
     */
    public TaskNotFoundException(String message, Throwable cause) {
        super(message, cause);
    }
}
