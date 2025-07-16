import { Component, signal, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TaskListComponent } from "./components/task-list/task-list.component";
import { TaskListService } from "./services/task-list.service";
import { TaskService } from "./services/task.service";
import { AlertComponent } from "./components/alert/alert.component";
import { ConfirmDialogComponent } from "./components/alert/confirm-dialog.component";
import { ConfirmDialogService } from "./services/confirm-dialog.service";
import { TaskList } from "./models/task-list.model";
import { ColumnDragDropService } from "./services/column-drag-drop.service";

@Component({
  selector: "app-root",
  standalone: true,
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
  imports: [
    CommonModule,
    AlertComponent,
    ConfirmDialogComponent,
    TaskListComponent,
  ],
})
export class AppComponent {
  private readonly taskListService = inject(TaskListService);
  private readonly taskService = inject(TaskService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly columnDnD = inject(ColumnDragDropService);

  readonly loading = this.taskListService.loading;
  showAddListForm = false;
  newListName = signal("");
  addListError = signal<string | null>(null);
  readonly MAX_LISTS = 6;

  // --- État pour édition du titre de chaque colonne ---
  editingTitleId = signal<number | null>(null); // id de la colonne éditée
  editingTitleValue = signal(""); // valeur temporaire

  // DnD colonne (états via service)
  readonly draggedListId = this.columnDnD.draggedListId;
  readonly dragOverIndex = this.columnDnD.dragOverIndex;

  // Rendu réactif de la liste ordonnée (avec déplacement en cours simulé)
  readonly lists = computed(() => {
    const listsRaw = this.taskListService.lists();
    const draggedId = this.draggedListId();
    const overIdx = this.dragOverIndex();
    if (draggedId == null || overIdx == null) return listsRaw;
    const currIdx = listsRaw.findIndex((l) => l.id === draggedId);
    if (currIdx === -1 || currIdx === overIdx) return listsRaw;
    // copie sans mutation
    const newArr = listsRaw.slice();
    const [dragged] = newArr.splice(currIdx, 1);
    newArr.splice(overIdx, 0, dragged);
    return newArr;
  });

  constructor() {
    this.taskListService.loadLists();
    this.taskService.loadTasks();
  }

  // -------------------- DRAG & DROP COLUMN ------------------------

  onColumnDragStart(listId: number, idx: number, event: DragEvent) {
    this.columnDnD.onColumnDragStart(listId, idx, event);
  }

  onColumnDragEnter(idx: number, event: DragEvent) {
    this.columnDnD.onColumnDragEnter(idx, event);
  }

  onColumnDragOver(idx: number, event: DragEvent) {
    this.columnDnD.onColumnDragOver(idx, event);
  }

  onColumnDrop(event: DragEvent) {
    this.columnDnD.onColumnDrop(event);
  }

  onColumnDragEnd() {
    this.columnDnD.onColumnDragEnd();
  }

  // -------------- ADD/DELETE LISTS & TASKS (inchangé) ---------------

  onListNameInput(event: Event): void {
    this.addListError.set(null);
    const input = event.target as HTMLInputElement | null;
    if (input) this.newListName.set(input.value);
  }

  addList(): void {
    const value = this.newListName().trim();
    if (!value) return;
    if (this.lists().length >= this.MAX_LISTS) {
      this.addListError.set("Maximum number of lists reached.");
      return;
    }
    this.taskListService.createList(value).subscribe({
      next: () => {
        this.taskListService.loadLists();
        this.newListName.set("");
        this.showAddListForm = false;
        this.addListError.set(null);
      },
      error: () => this.addListError.set("Failed to create list."),
    });
  }

  async deleteAllTasks(): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      "Suppression globale",
      "Voulez-vous vraiment supprimer toutes les tâches ?"
    );
    if (!confirmed) return;
    this.taskService.deleteAllTasks().subscribe({
      next: () => this.taskService.loadTasks(),
      error: (err) => console.error("Delete error:", err),
    });
  }

  // ----------- Suppression d'une colonne ----------
  async deleteList(listId: number, listName: string) {
    const confirmed = await this.confirmDialog.open(
      "Suppression de la liste",
      `Voulez-vous supprimer la liste “${listName}” et toutes ses tâches ?`
    );
    if (!confirmed) return;
    this.taskListService.deleteList(listId).subscribe({
      next: () => {},
      error: (err) => {
        alert("Erreur lors de la suppression de la liste");
        console.error(err);
      },
    });
  }

  // ----------- Suppression de toutes les tâches d'une colonne ----------
  async deleteAllInColumn(listId: number, listName: string) {
    const confirmed = await this.confirmDialog.open(
      "Suppression des tâches",
      `Voulez-vous supprimer toutes les tâches de “${listName}” ?`
    );
    if (!confirmed) return;
    this.taskService.deleteTasksByListId(listId);
  }

  // ----------- Edition du titre d'une colonne ----------
  startEditTitle(list: TaskList) {
    this.editingTitleId.set(list.id!);
    this.editingTitleValue.set(list.name);
    setTimeout(() => {
      const input = document.getElementById(
        `edit-list-title-${list.id}`
      ) as HTMLInputElement | null;
      if (input) input.focus();
    }, 0);
  }

  saveTitleEdit(list: TaskList) {
    const newName = this.editingTitleValue().trim();
    if (!newName || newName === list.name) {
      this.editingTitleId.set(null);
      return;
    }
    const updated: TaskList = {
      ...list,
      name: newName,
      position: list.position,
    };
    this.taskListService.updateList(updated).subscribe({
      next: () => {
        this.editingTitleId.set(null);
        this.taskListService.loadLists();
      },
      error: (err) => {
        alert("Erreur lors du renommage");
        console.error(err);
        this.editingTitleId.set(null);
      },
    });
  }

  cancelTitleEdit() {
    this.editingTitleId.set(null);
  }

  onEditTitleInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.editingTitleValue.set(input.value);
  }

  isEditingTitle(list: TaskList) {
    return this.editingTitleId() === list.id;
  }
}
