package com.inerio.taskmanager.repository;

import com.inerio.taskmanager.model.Board;
import com.inerio.taskmanager.model.KanbanColumn;
import com.inerio.taskmanager.model.Task;
import com.inerio.taskmanager.model.UserAccount;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@Testcontainers
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class TaskRepositoryTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired UserAccountRepository userAccountRepository;
    @Autowired BoardRepository boardRepository;
    @Autowired KanbanColumnRepository kanbanColumnRepository;
    @Autowired TaskRepository taskRepository;
    @Autowired EntityManager em;

    @Test
    @DisplayName("findByKanbanColumnOrderByPositionAscIdAsc — orders by position within the column")
    void orderByPositionWithinColumn() {
        UserAccount owner = userAccount("u-1");
        Board board = board(owner, "B1");
        KanbanColumn colA = column(board, "A", 0);
        KanbanColumn colB = column(board, "B", 1);

        Task a0 = taskRepository.save(task("A-0", colA, 0));
        Task a1 = taskRepository.save(task("A-1", colA, 1));
        Task a2 = taskRepository.save(task("A-2", colA, 2));

        taskRepository.save(task("B-0", colB, 0));
        taskRepository.save(task("B-1", colB, 1));

        em.flush();
        em.clear();

        List<Task> a = taskRepository.findByKanbanColumnOrderByPositionAscIdAsc(colA);

        assertThat(a).hasSize(3);
        assertThat(a).allMatch(t -> t.getKanbanColumn().getId().equals(colA.getId()));
        assertThat(a).extracting(Task::getPosition).containsExactly(0, 1, 2);
        assertThat(a).extracting(Task::getTitle).containsExactly("A-0", "A-1", "A-2");
        assertThat(a.getFirst().getId()).isEqualTo(a0.getId());
        assertThat(a.get(1).getId()).isEqualTo(a1.getId());
        assertThat(a.get(2).getId()).isEqualTo(a2.getId());
    }

    @Test
    @DisplayName("existsByIdAndKanbanColumnBoardOwnerUid works as ownership guard")
    void ownershipGuard_works() {
        UserAccount ownerA = userAccount("owner-A");
        Board bA = board(ownerA, "BA");
        KanbanColumn cA = column(bA, "CA", 0);
        Task tA = taskRepository.save(task("T-A", cA, 0));

        UserAccount ownerB = userAccount("owner-B");
        Board bB = board(ownerB, "BB");
        KanbanColumn cB = column(bB, "CB", 0);
        Task tB = taskRepository.save(task("T-B", cB, 0));

        em.flush(); em.clear();

        assertThat(taskRepository.existsByIdAndKanbanColumnBoardOwnerUid(tA.getId(), "owner-A")).isTrue();
        assertThat(taskRepository.existsByIdAndKanbanColumnBoardOwnerUid(tB.getId(), "owner-B")).isTrue();
        assertThat(taskRepository.existsByIdAndKanbanColumnBoardOwnerUid(tA.getId(), "owner-B")).isFalse();
        assertThat(taskRepository.existsByIdAndKanbanColumnBoardOwnerUid(tB.getId(), "owner-A")).isFalse();
    }

    @Test
    @DisplayName("findAllForOwnerOrdered returns only owner's tasks ordered by board -> column -> task -> id")
    void findAllForOwnerOrdered_scopedAndOrdered() {
        UserAccount ownerA = userAccount("oa");
        UserAccount ownerB = userAccount("ob");

        Board a1 = board(ownerA, "A1");
        Board a2 = board(ownerA, "A2");

        KanbanColumn a1c0 = column(a1, "A1-C0", 0);
        KanbanColumn a1c1 = column(a1, "A1-C1", 1);
        KanbanColumn a2c0 = column(a2, "A2-C0", 0);

        Task a1c0_t0 = taskRepository.save(task("a1c0-t0", a1c0, 0));
        Task a1c0_t1 = taskRepository.save(task("a1c0-t1", a1c0, 1));
        Task a1c1_t0 = taskRepository.save(task("a1c1-t0", a1c1, 0));
        Task a2c0_t0 = taskRepository.save(task("a2c0-t0", a2c0, 0));

        Board b1 = board(ownerB, "B1");
        KanbanColumn b1c0 = column(b1, "B1-C0", 0);
        taskRepository.save(task("noise", b1c0, 0));

        em.flush(); em.clear();

        List<Task> out = taskRepository.findAllForOwnerOrdered("oa");

        assertThat(out).extracting(t -> t.getKanbanColumn().getBoard().getOwner().getUid())
                .containsOnly("oa");

        assertThat(out).extracting(t -> t.getKanbanColumn().getBoard().getId())
                .isSorted();

        assertThat(out.stream().map(Task::getTitle).toList())
                .containsExactly(
                        a1c0_t0.getTitle(),
                        a1c0_t1.getTitle(),
                        a1c1_t0.getTitle(),
                        a2c0_t0.getTitle()
                );
    }

    private UserAccount userAccount(String uid) {
        UserAccount u = new UserAccount();
        u.setUid(uid);
        return userAccountRepository.save(u);
    }

    private Board board(UserAccount owner, String name) {
        Board b = new Board(name);
        b.setOwner(owner);
        return boardRepository.save(b);
    }

    private KanbanColumn column(Board board, String name, int pos) {
        KanbanColumn c = new KanbanColumn(name, pos);
        c.setBoard(board);
        return kanbanColumnRepository.save(c);
    }

    private static Task task(String title, KanbanColumn column, int pos) {
        Task t = new Task();
        t.setTitle(title);
        t.setKanbanColumn(column);
        t.setPosition(pos);
        return t;
    }
}
