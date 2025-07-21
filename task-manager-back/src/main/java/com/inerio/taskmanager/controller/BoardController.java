package com.inerio.taskmanager.controller;

import com.inerio.taskmanager.dto.BoardDto;
import com.inerio.taskmanager.dto.BoardMapperDto;
import com.inerio.taskmanager.model.Board;
import com.inerio.taskmanager.service.BoardService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

/**
 * REST controller for managing Kanban boards.
 * <p>
 * Provides endpoints for board CRUD operations.
 * </p>
 */
@RestController
@RequestMapping("/api/v1/boards")
@CrossOrigin(origins = "*") // TODO: Restrict in production for security!
public class BoardController {

    private final BoardService boardService;

    /**
     * Constructor with dependency injection.
     *
     * @param boardService the service handling board logic
     */
    public BoardController(BoardService boardService) {
        this.boardService = boardService;
    }

    /**
     * Get all boards, ordered by name.
     *
     * @return list of all boards as DTOs (no JPA cycles)
     */
    @GetMapping
    public ResponseEntity<List<BoardDto>> getAllBoards() {
        List<Board> boards = boardService.getAllBoards();
        if (boards.isEmpty()) return ResponseEntity.noContent().build();
        List<BoardDto> boardDtos = boards.stream()
            .map(BoardMapperDto::toDto)
            .toList();
        return ResponseEntity.ok(boardDtos);
    }

    /**
     * Get a single board by its ID.
     *
     * @param id the board ID
     * @return the board as DTO, or 404 if not found
     */
    @GetMapping("/{id}")
    public ResponseEntity<BoardDto> getBoardById(@PathVariable Long id) {
        return boardService.getBoardById(id)
            .map(BoardMapperDto::toDto)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Create a new board.
     *
     * @param board the board entity (only name required)
     * @return the created board as DTO (201 Created)
     */
    @PostMapping
    public ResponseEntity<BoardDto> createBoard(@RequestBody Board board) {
        Board created = boardService.createBoard(board);
        BoardDto dto = BoardMapperDto.toDto(created);
        return ResponseEntity.created(URI.create("/api/v1/boards/" + created.getId())).body(dto);
    }

    /**
     * Update a board's name.
     *
     * @param id the board ID
     * @param board the new board data (name)
     * @return the updated board as DTO, or 404 if not found
     */
    @PutMapping("/{id}")
    public ResponseEntity<BoardDto> updateBoard(@PathVariable Long id, @RequestBody Board board) {
        try {
            Board updated = boardService.updateBoard(id, board);
            BoardDto dto = BoardMapperDto.toDto(updated);
            return ResponseEntity.ok(dto);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Delete a board by ID.
     *
     * @param id the board ID
     * @return 204 No Content if deleted, 404 if not found
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBoard(@PathVariable Long id) {
        try {
            boardService.deleteBoard(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
