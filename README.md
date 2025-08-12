# Tasukeru

Task management application built with **Angular** (frontend) and **Spring Boot** (backend), with **PostgreSQL** persistence.

---

## Features

### Backend (Spring Boot)

- RESTful API for boards and tasks (CRUD)
- Create, edit, delete lists (Kanban columns)
- Create, edit, delete, and move tasks between lists
- Upload, download, and delete attachments
- Clean architecture (Controller / Service / Repository)
- PostgreSQL integration via JPA/Hibernate
- Docker configuration (`docker-compose.yml`)

### Frontend (Angular)

- Responsive Kanban interface (drag & drop)
- Add, edit, delete board, columns and tasks
- Drag & drop columns and tasks between columns (with smart constraints)
- Attachment management (upload, download, delete)
- Confirmation dialogs & notifications
- Reusable components (`Task`, `KanbanColumn`, etc.)
- Reactive state with Angular **Signals**
- Language & theme switchers
- Emoji picker with i18n (EN/FR) and localized search
- Template-based board setup on creation
- CORS support (`http://localhost:4200`)
- Board limit: up to **12** boards

---

## Tech Stack

| Technology  | Role              |
| ----------- | ----------------- |
| Angular 20  | Frontend UI       |
| TypeScript  | Frontend language |
| Spring Boot | Backend API       |
| Java 21     | Backend language  |
| PostgreSQL  | Database          |
| Docker      | DB container      |

---

## Getting Started

### Prerequisites

- Java 21
- Node.js + npm
- Angular CLI
- Docker (for the database)

### Steps

```bash
# 1. Start PostgreSQL via Docker
docker-compose up -d

# 2. Backend
cd task-manager-back
./mvnw spring-boot:run

# 3. Frontend
cd ../task-manager-front
npm install
ng serve
```

# Tasukeru

Application de gestion de tâches développée en **Angular** (frontend) et **Spring Boot** (backend), avec persistance **PostgreSQL**.

---

## Fonctionnalités

### Backend (Spring Boot)

- API RESTful pour tableaux et tâches (CRUD)
- Création, édition, suppression de listes (colonnes Kanban)
- Création, édition, suppression et déplacement des tâches entre colonnes
- Upload, téléchargement et suppression de pièces jointes
- Architecture claire (Controller / Service / Repository)
- Intégration PostgreSQL via JPA/Hibernate
- Configuration Docker (`docker-compose.yml`)

### Frontend (Angular)

- Interface Kanban responsive (glisser-déposer)
- Ajout, édition, suppression de **tableaux**, **colonnes** et **tâches**
- Glisser-déposer des **colonnes** et des **tâches** (déplacement entre colonnes, contraintes intelligentes)
- Gestion des pièces jointes (upload, téléchargement, suppression)
- Dialogues de confirmation & notifications
- Composants réutilisables (`Task`, `KanbanColumn`, etc.)
- État réactif avec **Angular Signals**
- Sélecteurs de langue et de thème
- Sélecteur d’émojis avec i18n (EN/FR) et recherche localisée
- Configuration du tableau à partir d’un modèle lors de la création
- Prise en charge du CORS (`http://localhost:4200`)
- Limite de tableaux : jusqu’à **12** tableaux

---

## Stack technique

| Technologie | Rôle               |
| ----------- | ------------------ |
| Angular 20  | Interface frontend |
| TypeScript  | Langage frontend   |
| Spring Boot | API backend        |
| Java 21     | Langage backend    |
| PostgreSQL  | Base de données    |
| Docker      | Conteneur BDD      |

---

## Lancer le projet

### Prérequis

- Java 21
- Node.js + npm
- Angular CLI
- Docker (pour la base de données)

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
