package com.inerio.taskmanager.controller;

import com.inerio.taskmanager.dto.BoardDto;
import com.inerio.taskmanager.dto.BoardMapperDto;
import com.inerio.taskmanager.dto.BoardReorderDto;
import com.inerio.taskmanager.model.Board;
import com.inerio.taskmanager.service.BoardService;
import com.inerio.taskmanager.service.UserAccountService;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller exposing CRUD and ordering endpoints for Kanban boards.
 * All operations are scoped to the caller via the {@code X-Client-Id} header.
 */
@RestController
@RequestMapping("/api/v1/boards")
public class BoardController {

    private final BoardService boardService;
    private final UserAccountService userAccountService;

    public BoardController(BoardService boardService, UserAccountService userAccountService) {
        this.boardService = boardService;
        this.userAccountService = userAccountService;
    }

    @GetMapping
    public ResponseEntity<List<BoardDto>> getAllBoards(@RequestHeader("X-Client-Id") String uid) {
        userAccountService.touch(uid);
        List<Board> boards = boardService.getAllBoards(uid);
        if (boards.isEmpty()) return ResponseEntity.noContent().build();
        List<BoardDto> boardDtos = boards.stream().map(BoardMapperDto::toDto).toList();
        return ResponseEntity.ok(boardDtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<BoardDto> getBoardById(@RequestHeader("X-Client-Id") String uid, @PathVariable Long id) {
        userAccountService.touch(uid);
        return boardService.getBoardById(uid, id)
            .map(BoardMapperDto::toDto)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<BoardDto> createBoard(@RequestHeader("X-Client-Id") String uid, @RequestBody Board board) {
        userAccountService.touch(uid);
        Board created = boardService.createBoard(uid, board);
        BoardDto dto = BoardMapperDto.toDto(created);
        return ResponseEntity.created(URI.create("/api/v1/boards/" + created.getId())).body(dto);
    }

    @PutMapping("/{id}")
    public ResponseEntity<BoardDto> updateBoard(@RequestHeader("X-Client-Id") String uid,
                                                @PathVariable Long id,
                                                @RequestBody Board board) {
        userAccountService.touch(uid);
        try {
            Board updated = boardService.updateBoard(uid, id, board);
            return ResponseEntity.ok(BoardMapperDto.toDto(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PutMapping("/reorder")
    public ResponseEntity<Void> reorderBoards(@RequestHeader("X-Client-Id") String uid,
                                              @RequestBody List<BoardReorderDto> items) {
        userAccountService.touch(uid);
        boardService.reorderBoards(uid, items);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBoard(@RequestHeader("X-Client-Id") String uid, @PathVariable Long id) {
        userAccountService.touch(uid);
        try {
            boardService.deleteBoard(uid, id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
