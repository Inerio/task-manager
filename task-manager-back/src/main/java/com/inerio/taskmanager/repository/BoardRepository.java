package com.inerio.taskmanager.repository;

import com.inerio.taskmanager.model.Board;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;

/**
 * Spring Data JPA repository for {@link Board} entities.
 */
public interface BoardRepository extends JpaRepository<Board, Long> {

    /**
     * Finds a board by its name.
     * @param name Board name.
     * @return Optional containing the board, if found.
     */
    Optional<Board> findByName(String name);

    /**
     * Finds all boards ordered by name (with columns fetched).
     *
     * @return list of boards with columns
     */
    @EntityGraph(attributePaths = "kanbanColumns")
    List<Board> findAllByOrderByNameAsc();

    /**
     * Finds a board by its ID, fetching its columns.
     *
     * @param id Board ID
     * @return Optional board with columns
     */
    @EntityGraph(attributePaths = "kanbanColumns")
    Optional<Board> findById(Long id);
}
