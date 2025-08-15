package com.inerio.taskmanager.repository;

import com.inerio.taskmanager.model.Board;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/**
 * Spring Data JPA repository for {@link Board} entities.
 * <p>
 * All read methods that include an owner UID parameter are intended to enforce
 * per-user data scoping.
 * </p>
 */
public interface BoardRepository extends JpaRepository<Board, Long> {

    /**
     * Finds a board by its name (not scoped).
     *
     * @param name board name
     * @return optional board
     */
    Optional<Board> findByName(String name);

    /**
     * Returns all boards for a given owner UID ordered by persistent position
     * (nulls sorted last) and then by name. Columns are fetched eagerly via
     * {@link EntityGraph} to avoid N+1 issues when rendering boards.
     *
     * @param uid owner UID
     * @return ordered list of boards for the owner
     */
    @EntityGraph(attributePaths = "kanbanColumns")
    @Query("""
           SELECT b
           FROM Board b
           WHERE b.owner.uid = :uid
           ORDER BY COALESCE(b.position, 2147483647), b.name ASC
           """)
    List<Board> findAllByOwnerUidOrderByPositionAscNullsLast(String uid);

    /**
     * Returns the maximum position value among the boards owned by the given UID.
     *
      * @param uid owner UID
     * @return highest position, or {@code null} if the owner has no boards
     */
    @Query("SELECT MAX(b.position) FROM Board b WHERE b.owner.uid = :uid")
    Integer findMaxPositionByOwnerUid(String uid);

    /**
     * Finds a board by id scoped to an owner UID.
     *
     * @param id  board id
     * @param uid owner UID
     * @return optional board if it belongs to the owner
     */
    Optional<Board> findByIdAndOwnerUid(Long id, String uid);

    /**
     * Finds multiple boards by ids scoped to an owner UID. Columns are fetched
     * eagerly via {@link EntityGraph}.
     *
     * @param ids board ids
     * @param uid owner UID
     * @return list of boards that belong to the owner
     */
    @EntityGraph(attributePaths = "kanbanColumns")
    List<Board> findAllByIdInAndOwnerUid(Collection<Long> ids, String uid);

    /**
     * Returns all boards for a given owner UID without a specific order.
     * Columns are fetched eagerly via {@link EntityGraph}.
     *
     * @param uid owner UID
     * @return list of boards for the owner
     */
    @EntityGraph(attributePaths = "kanbanColumns")
    List<Board> findAllByOwnerUid(String uid);
}
