package com.inerio.taskmanager.controller;

import com.inerio.taskmanager.dto.BoardDto;
import com.inerio.taskmanager.dto.BoardMapperDto;
import com.inerio.taskmanager.dto.BoardReorderDto;
import com.inerio.taskmanager.model.Board;
import com.inerio.taskmanager.service.BoardService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

/**
 * REST controller for managing Kanban boards.
 */
@RestController
@RequestMapping("/api/v1/boards")
@CrossOrigin(origins = "*") // TODO: Restrict in production for security!
public class BoardController {

    private final BoardService boardService;

    public BoardController(BoardService boardService) {
        this.boardService = boardService;
    }

    /** Get all boards, ordered by position (then name). */
    @GetMapping
    public ResponseEntity<List<BoardDto>> getAllBoards() {
        List<Board> boards = boardService.getAllBoards();
        if (boards.isEmpty()) return ResponseEntity.noContent().build();
        List<BoardDto> boardDtos = boards.stream()
            .map(BoardMapperDto::toDto)
            .toList();
        return ResponseEntity.ok(boardDtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<BoardDto> getBoardById(@PathVariable Long id) {
        return boardService.getBoardById(id)
            .map(BoardMapperDto::toDto)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<BoardDto> createBoard(@RequestBody Board board) {
        Board created = boardService.createBoard(board);
        BoardDto dto = BoardMapperDto.toDto(created);
        return ResponseEntity.created(URI.create("/api/v1/boards/" + created.getId())).body(dto);
    }

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
     * Reorder boards in bulk.
     * Accepts a list of (id, position) and normalizes to 0..n-1.
     */
    @PutMapping("/reorder")
    public ResponseEntity<Void> reorderBoards(@RequestBody List<BoardReorderDto> items) {
        boardService.reorderBoards(items);
        return ResponseEntity.noContent().build();
    }

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
