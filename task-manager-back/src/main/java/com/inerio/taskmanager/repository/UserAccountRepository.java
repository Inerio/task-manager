package com.inerio.taskmanager.repository;

import com.inerio.taskmanager.model.UserAccount;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/**
 * Spring Data JPA repository for {@link UserAccount} entities.
 * <p>
 * Provides lookups by stable client UID and utilities to find inactive accounts.
 * </p>
 */
public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {

    /**
     * Returns the account identified by the given stable client UID.
     *
     * @param uid stable client identifier
     * @return optional user account
     */
    Optional<UserAccount> findByUid(String uid);

    /**
     * Returns accounts whose {@code lastActiveAt} is strictly before the given cutoff instant.
     * Useful for inactivity-based retention cleanup.
     *
     * @param cutoff cutoff instant (exclusive upper bound)
     * @return list of inactive accounts
     */
    List<UserAccount> findByLastActiveAtBefore(Instant cutoff);

    /**
     * Atomically inserts a new account or updates the {@code lastActiveAt} timestamp
     * if the UID already exists. Eliminates race conditions on concurrent first-visit requests.
     *
     * @param uid stable client identifier
     */
    @Modifying
    @Transactional
    @Query(value = """
            INSERT INTO user_account (uid, created_at, last_active_at)
            VALUES (:uid, NOW(), NOW())
            ON CONFLICT (uid) DO UPDATE SET last_active_at = NOW()
            """, nativeQuery = true)
    void upsertTouch(@Param("uid") String uid);
}
