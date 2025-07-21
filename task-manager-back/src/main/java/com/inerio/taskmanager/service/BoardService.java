package com.inerio.taskmanager.service;

import com.inerio.taskmanager.model.Board;
import com.inerio.taskmanager.repository.BoardRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * Service layer for managing Kanban boards.
 * <p>
 * Handles business logic and CRUD operations for Board entities.
 * </p>
 */
@Service
public class BoardService {

    private final BoardRepository boardRepository;

    /**
     * Dependency injection constructor.
     *
     * @param boardRepository the JPA repository for Board entities
     */
    public BoardService(BoardRepository boardRepository) {
        this.boardRepository = boardRepository;
    }

    /**
     * Gets all boards in the system, ordered by name (columns are eagerly fetched).
     *
     * @return list of all boards
     */
    public List<Board> getAllBoards() {
        return boardRepository.findAllByOrderByNameAsc();
    }

    /**
     * Gets a board by its unique ID (columns are eagerly fetched).
     *
     * @param id the board ID
     * @return Optional containing the board if found, or empty
     */
    public Optional<Board> getBoardById(Long id) {
        return boardRepository.findById(id);
    }

    /**
     * Gets a board by its unique name.
     *
     * @param name the board name
     * @return Optional containing the board if found, or empty
     */
    public Optional<Board> getBoardByName(String name) {
        return boardRepository.findByName(name);
    }

    /**
     * Creates a new board with the given name.
     *
     * @param board the Board entity to create (name required)
     * @return the persisted Board entity
     */
    public Board createBoard(Board board) {
        // You may want to add unique name constraint checks here.
        return boardRepository.save(board);
    }

    /**
     * Updates an existing board's name.
     *
     * @param id the ID of the board to update
     * @param updated the board data (name)
     * @return the updated Board entity
     * @throws RuntimeException if board not found
     */
    public Board updateBoard(Long id, Board updated) {
        Board existing = boardRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Board not found with id " + id));
        existing.setName(updated.getName());
        return boardRepository.save(existing);
    }

    /**
     * Deletes a board by its ID, along with all its columns and tasks (cascade).
     *
     * @param id the ID of the board to delete
     * @throws RuntimeException if board not found
     */
    public void deleteBoard(Long id) {
        if (!boardRepository.existsById(id)) {
            throw new RuntimeException("Board not found with id " + id);
        }
        boardRepository.deleteById(id);
    }
}
