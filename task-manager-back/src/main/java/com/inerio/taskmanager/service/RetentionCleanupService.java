package com.inerio.taskmanager.service;

import com.inerio.taskmanager.model.UserAccount;
import com.inerio.taskmanager.repository.UserAccountRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Scheduled service that removes data for accounts inactive beyond a configured retention period.
 * <p>
 * Deletes all boards (and related on-disk attachments via {@link BoardService}) for stale accounts,
 * then removes the corresponding user accounts.
 * </p>
 */
@Service
public class RetentionCleanupService {

    private static final Logger log = LoggerFactory.getLogger(RetentionCleanupService.class);

    private final UserAccountRepository userAccountRepository;
    private final BoardService boardService;

    @Value("${app.retention-days:90}")
    private int retentionDays;

    public RetentionCleanupService(UserAccountRepository userAccountRepository,
                                   BoardService boardService) {
        this.userAccountRepository = userAccountRepository;
        this.boardService = boardService;
    }

    /**
     * Runs once per day at 03:00 server time.
     * <p>
     * For each user whose {@code lastActiveAt} is older than the retention window,
     * deletes all their boards (including attachment folders) and then removes the account.
     * </p>
     */
    @Scheduled(cron = "0 0 3 * * *", zone = "Europe/Paris")
    public void cleanupInactiveAccounts() {
        Instant cutoff = Instant.now().minus(retentionDays, ChronoUnit.DAYS);
        List<UserAccount> stale = userAccountRepository.findByLastActiveAtBefore(cutoff);
        if (stale.isEmpty()) {
            return;
        }

        for (UserAccount ua : stale) {
            String uid = ua.getUid();
            try {
                boardService.getAllBoards(uid).forEach(b -> {
                    try {
                        boardService.deleteBoard(uid, b.getId());
                    } catch (Exception ex) {
                        log.warn("Failed deleting board {} for uid {}: {}", b.getId(), uid, ex.getMessage());
                    }
                });
                userAccountRepository.delete(ua);
                log.info("Deleted inactive user data for uid={}", uid);
            } catch (Exception e) {
                log.warn("Retention cleanup failed for uid={}: {}", uid, e.getMessage());
            }
        }
    }
}
