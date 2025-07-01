# Task Manager

Application de gestion de tâches développée en **Angular** (frontend) et **Spring Boot** (backend), avec persistance dans une base de données **PostgreSQL**.

---

## Fonctionnalités

### Backend (Spring Boot)
- API REST sécurisée
- Architecture claire (Controller / Service / Repository)
- Intégration PostgreSQL avec JPA/Hibernate
- Configuration Docker (`docker-compose`)

### Frontend (Angular)
- UI responsive et claire
- Composants réutilisables : `TaskItem`, `TaskList`
- Requêtes HTTP via `HttpClient`
- Affichage dynamique des tâches
- Prise en charge du CORS (`http://localhost:4200`)

---

## Stack Technique

| Technologie | Rôle                    |
|-------------|-------------------------|
| Angular     | Interface utilisateur   |
| TypeScript  | Langage frontend        |
| Spring Boot | API REST backend        |
| Java 21     | Langage backend         |
| PostgreSQL  | Base de données         |
| Docker      | Conteneurisation BDD    |

---

## Lancer le projet

### Prérequis
- Java 21
- Node.js + npm
- Angular CLI
- Docker (pour la BDD)

### Étapes

```bash
# 1. Lancer PostgreSQL via Docker
docker-compose up -d

# 2. Backend
cd task-manager-back
./mvnw spring-boot:run

# 3. Frontend
cd ../task-manager-front
npm install
ng serve
