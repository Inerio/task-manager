package com.inerio.taskmanager.api;

import com.inerio.taskmanager.model.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

import org.testcontainers.containers.PostgreSQLContainer;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration Test: boots Spring Boot + real Postgres (Testcontainers) and
 * verifies that PUT /api/v1/tasks/reorder correctly persists the new order.
 *
 * No DynamicPropertySource: we start the container in a static block and set
 * spring.datasource.* system props before the Spring context is created.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class TaskApiIT {

  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:15-alpine");

  static {
    POSTGRES.start();
    System.setProperty("spring.datasource.url", POSTGRES.getJdbcUrl());
    System.setProperty("spring.datasource.username", POSTGRES.getUsername());
    System.setProperty("spring.datasource.password", POSTGRES.getPassword());
    System.setProperty("spring.jpa.hibernate.ddl-auto", "update");
  }

  @AfterAll
  static void stopContainer() { POSTGRES.stop(); }

  @LocalServerPort int port;
  @Autowired TestRestTemplate rest;
  @PersistenceContext EntityManager em;

  @Autowired TransactionTemplate tx;

  private static final String UID = "it-user-123";

  @BeforeEach
  void clean() {
    // Run bulk deletes inside a real transaction (required by JPA)
    tx.execute(status -> {
      // Delete children -> parents
      em.createQuery("delete from Task").executeUpdate();
      em.createQuery("delete from KanbanColumn").executeUpdate();
      em.createQuery("delete from Board").executeUpdate();
      em.createQuery("delete from UserAccount").executeUpdate();
      em.flush();
      return null;
    });
  }

  @Test
  void reorder_persists_new_order() {
    // ---------- Arrange (insert seed data inside a committed transaction) ----------
    final Long[] ids = new Long[4]; // [0]=id0, [1]=id1, [2]=id2, [3]=colId

    tx.execute(status -> {
      var user = new UserAccount(UID);
      em.persist(user);

      var board = new Board();
      board.setName("IT Board");
      board.setOwner(user);
      em.persist(board);

      var col = new KanbanColumn();
      col.setName("Todo");
      col.setPosition(0);
      col.setBoard(board);
      em.persist(col);

      var t0 = new Task();
      t0.setTitle("A");
      t0.setPosition(0);
      t0.setKanbanColumn(col);
      em.persist(t0);

      var t1 = new Task();
      t1.setTitle("B");
      t1.setPosition(1);
      t1.setKanbanColumn(col);
      em.persist(t1);

      var t2 = new Task();
      t2.setTitle("C");
      t2.setPosition(2);
      t2.setKanbanColumn(col);
      em.persist(t2);

      em.flush();

      ids[0] = t0.getId();
      ids[1] = t1.getId();
      ids[2] = t2.getId();
      ids[3] = col.getId();
      return null;
    });

    Long id0 = ids[0], id1 = ids[1], id2 = ids[2], colId = ids[3];

    // ---------- Act ----------
    List<Map<String, Object>> payload = List.of(
      Map.of("id", id2, "position", 0),
      Map.of("id", id0, "position", 1),
      Map.of("id", id1, "position", 2)
    );
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.set("X-Client-Id", UID);

    ResponseEntity<Void> resp = rest.exchange(
      "http://localhost:" + port + "/api/v1/tasks/reorder",
      HttpMethod.PUT,
      new HttpEntity<>(payload, headers),
      Void.class
    );
    assertThat(resp.getStatusCode().is2xxSuccessful()).isTrue();

    // ---------- Assert ----------
    em.clear();
    List<Long> idsAsc = em.createQuery(
      "select t.id from Task t where t.kanbanColumn.id = :cid order by t.position asc", Long.class)
      .setParameter("cid", colId)
      .getResultList();

    assertThat(idsAsc).containsExactly(id2, id0, id1);
  }
}
