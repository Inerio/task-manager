package com.inerio.taskmanager.exception;

/**
 * Exception thrown when a Task with a given ID does not exist.
 * Used to signal missing resources in the service layer.
 */
public class TaskNotFoundException extends RuntimeException {
	
	private static final long serialVersionUID = 1L;
	
	public TaskNotFoundException(String message) {
        super(message);
    }
}
