# Task Manager

Application de gestion de tâches développée en **Angular** (frontend) et **Spring Boot** (backend), avec persistance dans une base de données **PostgreSQL**.

---

## Fonctionnalités

### Backend (Spring Boot)

- API RESTful pour listes et tâches (CRUD)
- Création, édition, suppression de listes (colonnes Kanban)
- Création, édition, suppression, déplacement de tâches entre listes
- Upload, téléchargement, suppression de pièces jointes
- Architecture claire (Controller / Service / Repository)
- Intégration PostgreSQL avec JPA/Hibernate
- Configuration Docker (`docker-compose.yml`)

### Frontend (Angular)

- Interface responsive type Kanban (drag & drop)
- Création et suppression de listes
- Ajout, édition, suppression de tâches
- Drag & drop de tâches entre listes (avec restrictions intelligentes)
- Gestion des pièces jointes (upload, téléchargement, suppression)
- Dialogues de confirmation & notifications
- Composants réutilisables (`TaskItem`, `TaskList`, etc.)
- Gestion d’état réactif (Signals Angular)
- Prise en charge du CORS (`http://localhost:4200`)

---

## Stack technique

| Technologie | Rôle                  |
| ----------- | --------------------- |
| Angular     | Interface utilisateur |
| TypeScript  | Langage frontend      |
| Spring Boot | API REST backend      |
| Java 21     | Langage backend       |
| PostgreSQL  | Base de données       |
| Docker      | Conteneurisation BDD  |

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
```
