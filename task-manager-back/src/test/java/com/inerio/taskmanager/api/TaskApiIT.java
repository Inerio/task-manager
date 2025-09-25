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
import org.springframework.context.annotation.Bean;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Import(TaskApiIT.TestConfig.class)
class TaskApiIT {

  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:15-alpine");

  static {
    POSTGRES.start();
    System.setProperty("spring.datasource.url", POSTGRES.getJdbcUrl());
    System.setProperty("spring.datasource.username", POSTGRES.getUsername());
    System.setProperty("spring.datasource.password", POSTGRES.getPassword());
    System.setProperty("spring.jpa.hibernate.ddl-auto", "update");

    String uploads = Path.of(System.getProperty("java.io.tmpdir"), "tm-uploads-it").toString();
    System.setProperty("app.upload-dir", uploads);
    System.setProperty("app.uploadDir", uploads);
  }

  @AfterAll
  static void stopContainer() { POSTGRES.stop(); }

  @LocalServerPort int port;
  @Autowired TestRestTemplate rest;
  @PersistenceContext EntityManager em;
  @Autowired TransactionTemplate tx;
  @TestConfiguration
  static class TestConfig {
    @Bean
    com.inerio.taskmanager.realtime.SseHub sseHub() {
      return mock(com.inerio.taskmanager.realtime.SseHub.class);
    }
  }

  private static final String UID = "it-user-123";

  @BeforeEach
  void clean() {
    tx.execute(status -> {
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
    final Long[] ids = new Long[4];

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

    em.clear();
    List<Long> idsAsc = em.createQuery(
      "select t.id from Task t where t.kanbanColumn.id = :cid order by t.position asc", Long.class)
      .setParameter("cid", colId)
      .getResultList();

    assertThat(idsAsc).containsExactly(id2, id0, id1);
  }
}
