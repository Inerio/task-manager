import { Component, signal, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { KanbanColumnComponent } from "./components/kanban-column/kanban-column.component";
import { KanbanColumnService } from "./services/kanban-column.service";
import { TaskService } from "./services/task.service";
import { AlertComponent } from "./components/alert/alert.component";
import { ConfirmDialogComponent } from "./components/alert/confirm-dialog.component";
import { ConfirmDialogService } from "./services/confirm-dialog.service";
import { KanbanColumn } from "./models/kanban-column.model";
import { ColumnDragDropService } from "./services/kanban-column-drag-drop.service";

@Component({
  selector: "app-root",
  standalone: true,
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
  imports: [
    CommonModule,
    AlertComponent,
    ConfirmDialogComponent,
    KanbanColumnComponent,
  ],
})
export class AppComponent {
  private readonly kanbanColumnService = inject(KanbanColumnService);
  private readonly taskService = inject(TaskService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly columnDnD = inject(ColumnDragDropService);

  readonly loading = this.kanbanColumnService.loading;
  addKanbanColumnError = signal<string | null>(null);
  readonly MAX_KANBANCOLUMNS = 6;

  // --- État pour édition du titre de chaque colonne ---
  editingTitleId = signal<number | null>(null); // id de la colonne éditée
  editingTitleValue = signal(""); // valeur temporaire

  // DnD colonne (états via service)
  readonly draggedKanbanColumnId = this.columnDnD.draggedKanbanColumnId;
  readonly dragOverIndex = this.columnDnD.dragOverIndex;

  // Rendu réactif de la kanbanColumne ordonnée (avec déplacement en cours simulé)
  readonly kanbanColumns = computed(() => {
    const kanbanColumnsRaw = this.kanbanColumnService.kanbanColumns();
    const draggedId = this.draggedKanbanColumnId();
    const overIdx = this.dragOverIndex();
    if (draggedId == null || overIdx == null) return kanbanColumnsRaw;
    const currIdx = kanbanColumnsRaw.findIndex((l) => l.id === draggedId);
    if (currIdx === -1 || currIdx === overIdx) return kanbanColumnsRaw;
    // copie sans mutation
    const newArr = kanbanColumnsRaw.slice();
    const [dragged] = newArr.splice(currIdx, 1);
    newArr.splice(overIdx, 0, dragged);
    return newArr;
  });

  constructor() {
    this.kanbanColumnService.loadKanbanColumns();
    this.taskService.loadTasks();
  }

  // -------------------- DRAG & DROP COLUMN ------------------------
  onColumnDragStart(kanbanColumnId: number, idx: number, event: DragEvent) {
    if (this.editingTitleId()) return; // Block drag if editing
    this.columnDnD.onColumnDragStart(kanbanColumnId, idx, event);
  }
  onColumnDragEnter(idx: number, event: DragEvent) {
    if (this.editingTitleId()) return;
    this.columnDnD.onColumnDragEnter(idx, event);
  }
  onColumnDragOver(idx: number, event: DragEvent) {
    if (this.editingTitleId()) return;
    this.columnDnD.onColumnDragOver(idx, event);
  }
  onColumnDrop(event: DragEvent) {
    if (this.editingTitleId()) return;
    this.columnDnD.onColumnDrop(event);
  }
  onColumnDragEnd() {
    if (this.editingTitleId()) return;
    this.columnDnD.onColumnDragEnd();
  }

  // ----------- ADD COLUMN + OPEN EDIT MODE -----------
  addKanbanColumnAndEdit(): void {
    if (this.kanbanColumns().length >= this.MAX_KANBANCOLUMNS) return;
    if (this.editingTitleId()) return; // block if editing
    this.kanbanColumnService.createKanbanColumn("").subscribe({
      next: () => {
        this.kanbanColumnService.loadKanbanColumns();
        setTimeout(() => {
          const last = this.kanbanColumnService.kanbanColumns().slice(-1)[0];
          if (last) this.startEditTitle(last);
        }, 150);
      },
      error: () =>
        this.addKanbanColumnError.set("Failed to create kanbanColumn."),
    });
  }

  // ----------- Suppression d'une colonne ----------
  async deleteKanbanColumn(kanbanColumnId: number, kanbanColumnName: string) {
    if (this.editingTitleId()) return;
    const confirmed = await this.confirmDialog.open(
      "Suppression de la kanbanColumne",
      `Voulez-vous supprimer la kanbanColumne “${kanbanColumnName}” et toutes ses tâches ?`
    );
    if (!confirmed) return;
    this.kanbanColumnService.deleteKanbanColumn(kanbanColumnId).subscribe({
      next: () => {},
      error: (err) => {
        alert("Erreur lors de la suppression de la kanbanColumne");
        console.error(err);
      },
    });
  }

  // ----------- Suppression de toutes les tâches d'une colonne ----------
  async deleteAllInColumn(kanbanColumnId: number, kanbanColumnName: string) {
    if (this.editingTitleId()) return;
    const confirmed = await this.confirmDialog.open(
      "Suppression des tâches",
      `Voulez-vous supprimer toutes les tâches de “${kanbanColumnName}” ?`
    );
    if (!confirmed) return;
    this.taskService.deleteTasksByKanbanColumnId(kanbanColumnId);
  }

  // ----------- Suppression de toutes les tâches ----------
  async deleteAllTasks(): Promise<void> {
    if (this.editingTitleId()) return;
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

  // ----------- Edition du titre d'une colonne ----------
  startEditTitle(kanbanColumn: KanbanColumn) {
    if (this.editingTitleId()) return;
    this.editingTitleId.set(kanbanColumn.id!);
    this.editingTitleValue.set(kanbanColumn.name);
    setTimeout(() => {
      const input = document.getElementById(
        `edit-kanbanColumn-title-${kanbanColumn.id}`
      ) as HTMLInputElement | null;
      if (input) input.focus();
    }, 0);
  }

  saveTitleEdit(kanbanColumn: KanbanColumn) {
    const newName = this.editingTitleValue().trim();
    if (!newName) return; // block empty
    if (newName === kanbanColumn.name) {
      this.editingTitleId.set(null);
      return;
    }
    const updated: KanbanColumn = {
      ...kanbanColumn,
      name: newName,
      position: kanbanColumn.position,
    };
    this.kanbanColumnService.updateKanbanColumn(updated).subscribe({
      next: () => {
        this.editingTitleId.set(null);
        this.kanbanColumnService.loadKanbanColumns();
      },
      error: (err) => {
        alert("Erreur lors du renommage");
        console.error(err);
        this.editingTitleId.set(null);
      },
    });
  }

  cancelTitleEdit() {
    // ----- SI ANNULATION et nom vide, supprime la colonne -----
    const id = this.editingTitleId();
    const currKanbanColumn = this.kanbanColumnService
      .kanbanColumns()
      .find((l) => l.id === id);
    if (
      currKanbanColumn &&
      (!currKanbanColumn.name || currKanbanColumn.name.trim() === "")
    ) {
      // supprime la colonne "fantôme"
      this.kanbanColumnService
        .deleteKanbanColumn(currKanbanColumn.id!)
        .subscribe({
          next: () => this.editingTitleId.set(null),
          error: () => this.editingTitleId.set(null),
        });
    } else {
      this.editingTitleId.set(null);
    }
  }

  onEditTitleInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.editingTitleValue.set(input.value);
  }

  isEditingTitle(kanbanColumn: KanbanColumn) {
    return this.editingTitleId() === kanbanColumn.id;
  }
}
