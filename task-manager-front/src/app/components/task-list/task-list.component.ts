import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Task } from "../../models/task.model";
import { TaskService } from "../../services/task.service";
import { TaskItemComponent } from "../task-item/task-item.component";

/**
 * Composant représentant une colonne de tâches (À faire, En cours, Terminées).
 * Filtre et affiche uniquement les tâches correspondant à son `status`.
 */
@Component({
  selector: "app-task-list",
  standalone: true,
  imports: [CommonModule, FormsModule, TaskItemComponent],
  templateUrl: "./task-list.component.html",
  styleUrls: ["./task-list.component.scss"],
})
export class TaskListComponent implements OnInit {
  @Input() title!: string;
  @Input() status!: "todo" | "in-progress" | "done";

  tasks: Task[] = [];
  filteredTasks: Task[] = [];

  showForm = false;
  newTask: Partial<Task> = this.getEmptyTask();

  constructor(private taskService: TaskService) {}

  /** Chargement initial */
  ngOnInit(): void {
    this.loadTasks();
  }

  /** Charge toutes les tâches puis filtre selon le statut */
  loadTasks(): void {
    this.taskService.getTasks().subscribe({
      next: (data) => {
        this.tasks = data;
        this.filteredTasks = Array.isArray(data)
          ? data.filter((task) => task.status === this.status)
          : [];
      },
      error: (err) => {
        console.error("Erreur chargement des tâches :", err);
      },
    });
  }

  /** Bascule l’affichage du formulaire d’ajout */
  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) this.resetForm();
  }

  /** Ajoute une nouvelle tâche */
  addTask(): void {
    const { title, description } = this.newTask;
    if (!title || !description) return;

    const taskToCreate: Task = {
      title,
      description,
      completed: false,
      status: this.status,
    };

    this.taskService.createTask(taskToCreate).subscribe({
      next: (created) => {
        this.filteredTasks.push(created);
        this.resetForm();
        this.showForm = false;
      },
      error: (err) => console.error("Erreur création tâche :", err),
    });
  }

  /** Réinitialise le formulaire */
  private resetForm(): void {
    this.newTask = this.getEmptyTask();
  }

  /** Fournit un template vide pour la création */
  private getEmptyTask(): Partial<Task> {
    return {
      title: "",
      description: "",
      completed: false,
    };
  }

  /** Supprime la tâche visuellement après suppression API */
  handleTaskDeleted(deletedId: number): void {
    this.filteredTasks = this.filteredTasks.filter(
      (task) => task.id !== deletedId
    );
  }

  /** Met à jour la tâche dans le tableau après un changement */
  handleTaskUpdated(updated: Task): void {
    this.taskService.updateTask(updated.id!, updated).subscribe({
      next: (saved) => {
        const index = this.filteredTasks.findIndex((t) => t.id === saved.id);
        if (index !== -1) this.filteredTasks[index] = saved;
      },
      error: (err) => {
        console.error("Erreur mise à jour tâche :", err);
      },
    });
  }
}
