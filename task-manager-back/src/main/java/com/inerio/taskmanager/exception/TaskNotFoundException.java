package com.inerio.taskmanager.exception;

/**
 * Exception levee lorsqu'une tache avec un ID donne n'existe pas.
 */

public class TaskNotFoundException extends RuntimeException {
	
	private static final long serialVersionUID = 1L;
	
	public TaskNotFoundException(String message) {
        super(message);
    }
}
