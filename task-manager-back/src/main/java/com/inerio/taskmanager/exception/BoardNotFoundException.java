package com.inerio.taskmanager.exception;

/**
 * Runtime exception indicating that a requested {@code Board} was not found.
 */
public class BoardNotFoundException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public BoardNotFoundException(String message) {
        super(message);
    }

    public BoardNotFoundException(String message, Throwable cause) {
        super(message, cause);
    }
}
