package com.inerio.taskmanager.repository;

import com.inerio.taskmanager.model.UserAccount;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
