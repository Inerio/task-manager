package com.inerio.taskmanager.repository;

import com.inerio.taskmanager.model.Board;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.List;

/**
 * Spring Data JPA repository for {@link Board} entities.
 */
public interface BoardRepository extends JpaRepository<Board, Long> {

    Optional<Board> findByName(String name);

    /**
     * Order by position (NULLS LAST for legacy rows), then by name.
     * JPQL COALESCE ensures nulls are considered larger than any real value.
     */
    @EntityGraph(attributePaths = "kanbanColumns")
    @Query("SELECT b FROM Board b ORDER BY COALESCE(b.position, 2147483647), b.name ASC")
    List<Board> findAllOrderByPositionAscNullsLast();

    /** Highest position currently in DB (nullable if no boards). */
    @Query("SELECT MAX(b.position) FROM Board b")
    Integer findMaxPosition();
}
