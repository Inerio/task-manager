package com.inerio.taskmanager.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Anonymous user account (soft identity).
 * Identified by a stable client-provided UID and used to scope boards and data.
 */
@Entity
@Table(
        name = "user_account",
        indexes = @Index(name = "ux_user_account_uid", columnList = "uid", unique = true)
)
public class UserAccount {

    /** Database-generated identifier. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Stable UID provided by the client (e.g., via {@code X-Client-Id}). */
    @Column(nullable = false, unique = true, length = 64)
    private String uid;

    /** Creation timestamp. */
    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    /** Last activity timestamp (updated on API usage). */
    @Column(nullable = false)
    private Instant lastActiveAt = Instant.now();

    /**
     * Boards owned by this account.
     * Cascade deletes ensure user data is removed when the account is deleted.
     */
    @OneToMany(mappedBy = "owner", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Board> boards = new ArrayList<>();

    /** Default constructor for JPA. */
    public UserAccount() { }

    /** Creates an account with the given client UID. */
    public UserAccount(String uid) {
        this.uid = uid;
        this.createdAt = Instant.now();
        this.lastActiveAt = this.createdAt;
    }

    /** @return the account id */
    public Long getId() {
        return id;
    }

    /** @return the stable client UID */
    public String getUid() {
        return uid;
    }

    /** @param uid stable client UID */
    public void setUid(String uid) {
        this.uid = uid;
    }

    /** @return creation timestamp */
    public Instant getCreatedAt() {
        return createdAt;
    }

    /** @param createdAt creation timestamp */
    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    /** @return last activity timestamp */
    public Instant getLastActiveAt() {
        return lastActiveAt;
    }

    /** @param lastActiveAt last activity timestamp */
    public void setLastActiveAt(Instant lastActiveAt) {
        this.lastActiveAt = lastActiveAt;
    }

    /** @return boards owned by this account */
    public List<Board> getBoards() {
        return boards;
    }

    /** @param boards boards owned by this account */
    public void setBoards(List<Board> boards) {
        this.boards = boards;
    }
}
