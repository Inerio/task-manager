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
    @DisplayName("findByKanbanColumnOrderByPositionAsc returns tasks ordered within the column")
    void orderByPositionWithinColumn() {
        // owner + board
        UserAccount owner = new UserAccount();
        owner.setUid("u-1");
        owner = userAccountRepository.save(owner);

        Board board = new Board("B1");
        board.setOwner(owner);
        board = boardRepository.save(board);

        // two columns: A (target) and B (noise)
        KanbanColumn colA = new KanbanColumn("A", 0);
        colA.setBoard(board);
        KanbanColumn savedColA = kanbanColumnRepository.save(colA);

        KanbanColumn colB = new KanbanColumn("B", 1);
        colB.setBoard(board);
        KanbanColumn savedColB = kanbanColumnRepository.save(colB);

        // tasks in A (shuffled)
        taskRepository.save(newTask("A-2", savedColA, 2));
        taskRepository.save(newTask("A-0", savedColA, 0));
        taskRepository.save(newTask("A-1", savedColA, 1));

        // noise in B
        taskRepository.save(newTask("B-0", savedColB, 0));
        taskRepository.save(newTask("B-1", savedColB, 1));

        em.flush();
        em.clear();

        // Act
        List<Task> a = taskRepository.findByKanbanColumnOrderByPositionAsc(savedColA);

        // Assert
        assertThat(a).hasSize(3);
        assertThat(a).extracting(Task::getTitle).containsExactly("A-0", "A-1", "A-2");
        assertThat(a).extracting(Task::getPosition).containsExactly(0, 1, 2);
        assertThat(a).allMatch(t -> t.getKanbanColumn().getId().equals(savedColA.getId()));
    }

    @Test
    @DisplayName("existsByIdAndKanbanColumnBoardOwnerUid works as ownership guard")
    void ownershipGuard_works() {
        // owner A + board/column/task
        UserAccount ownerA = new UserAccount(); ownerA.setUid("owner-A");
        ownerA = userAccountRepository.save(ownerA);
        Board bA = new Board("BA"); bA.setOwner(ownerA); bA = boardRepository.save(bA);
        KanbanColumn cA = new KanbanColumn("CA", 0); cA.setBoard(bA); KanbanColumn savedCA = kanbanColumnRepository.save(cA);
        Task tA = taskRepository.save(newTask("T-A", savedCA, 0));

        // owner B + board/column/task
        UserAccount ownerB = new UserAccount(); ownerB.setUid("owner-B");
        ownerB = userAccountRepository.save(ownerB);
        Board bB = new Board("BB"); bB.setOwner(ownerB); bB = boardRepository.save(bB);
        KanbanColumn cB = new KanbanColumn("CB", 0); cB.setBoard(bB); KanbanColumn savedCB = kanbanColumnRepository.save(cB);
        Task tB = taskRepository.save(newTask("T-B", savedCB, 0));

        em.flush(); em.clear();

        assertThat(taskRepository.existsByIdAndKanbanColumnBoardOwnerUid(tA.getId(), "owner-A")).isTrue();
        assertThat(taskRepository.existsByIdAndKanbanColumnBoardOwnerUid(tB.getId(), "owner-B")).isTrue();
        assertThat(taskRepository.existsByIdAndKanbanColumnBoardOwnerUid(tA.getId(), "owner-B")).isFalse();
        assertThat(taskRepository.existsByIdAndKanbanColumnBoardOwnerUid(tB.getId(), "owner-A")).isFalse();
    }

    private static Task newTask(String title, KanbanColumn column, int pos) {
        Task t = new Task();
        t.setTitle(title);
        t.setKanbanColumn(column);
        t.setPosition(pos);
        return t;
    }
}
