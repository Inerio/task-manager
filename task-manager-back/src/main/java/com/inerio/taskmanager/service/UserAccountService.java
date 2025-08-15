package com.inerio.taskmanager.service;

import com.inerio.taskmanager.model.UserAccount;
import com.inerio.taskmanager.repository.UserAccountRepository;
import java.time.Instant;
import org.springframework.stereotype.Service;

/**
 * Service for managing anonymous user accounts (soft identities).
 * <p>
 * Provides helpers to retrieve or lazily create accounts and to update activity timestamps.
 * </p>
 */
@Service
public class UserAccountService {

    private final UserAccountRepository repo;

    /**
     * Creates a new {@code UserAccountService}.
     *
     * @param repo repository for {@link UserAccount} persistence
     */
    public UserAccountService(UserAccountRepository repo) {
        this.repo = repo;
        }

    /**
     * Returns the existing account for the given UID or creates and persists a new one.
     *
     * @param uid stable anonymous user identifier
     * @return existing or newly created {@link UserAccount}
     */
    public UserAccount getOrCreate(String uid) {
        return repo.findByUid(uid).orElseGet(() -> repo.save(new UserAccount(uid)));
    }

    /**
     * Updates the {@code lastActiveAt} timestamp for the given UID.
     * If no account exists yet, one is created and then updated.
     *
     * @param uid stable anonymous user identifier
     */
    public void touch(String uid) {
        UserAccount acc = repo.findByUid(uid).orElseGet(() -> new UserAccount(uid));
        acc.setLastActiveAt(Instant.now());
        repo.save(acc);
    }
}
