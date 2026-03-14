package com.inerio.taskmanager.service;

import com.inerio.taskmanager.model.UserAccount;
import com.inerio.taskmanager.repository.UserAccountRepository;
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
        return repo.findByUid(uid).orElseGet(() -> {
            try {
                return repo.save(new UserAccount(uid));
            } catch (org.springframework.dao.DataIntegrityViolationException e) {
                // Concurrent insert — the other thread won; just fetch the existing row.
                return repo.findByUid(uid).orElseThrow();
            }
        });
    }

    /**
     * Updates the {@code lastActiveAt} timestamp for the given UID.
     * If no account exists yet, one is created atomically (upsert).
     *
     * @param uid stable anonymous user identifier
     */
    public void touch(String uid) {
        repo.upsertTouch(uid);
    }

}
