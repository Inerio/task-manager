import { Component, signal, inject, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { AlertComponent } from "./components/alert/alert.component";
import { ConfirmDialogComponent } from "./components/alert/confirm-dialog.component";
import { BoardComponent } from "./components/board/board.component";
import { BoardService } from "./services/board.service";
import { ConfirmDialogService } from "./services/confirm-dialog.service";
import { TaskService } from "./services/task.service";

interface TempBoard {
  id: null;
  name: string;
}

@Component({
  selector: "app-root",
  standalone: true,
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
  imports: [
    CommonModule,
    AlertComponent,
    ConfirmDialogComponent,
    BoardComponent,
  ],
})
export class AppComponent {
  // ==== State and injected services ====
  private readonly boardService = inject(BoardService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly taskService = inject(TaskService);

  readonly boards = this.boardService.boards;
  readonly selectedBoardId = signal<number | null>(null);

  /** Inline add board state */
  readonly editingBoardId = signal<number | null>(null);
  readonly editingBoardValue = signal<string>("");

  /** Edit mode for selected board title (main area) */
  readonly editingSelectedBoard = signal<boolean>(false);
  readonly editingSelectedBoardValue = signal<string>("");

  /** Displayed boards (computed: boards + temp new board if editing) */
  readonly displayedBoards = computed(() => {
    if (this.editingBoardId() === null) return this.boards();
    return [
      ...this.boards(),
      { id: null, name: this.editingBoardValue() } as TempBoard,
    ];
  });

  constructor() {
    this.boardService.loadBoards();
    // Automatically select the first board on load if none selected
    computed(() => {
      const firstId = this.boards()[0]?.id;
      if (typeof firstId === "number" && this.selectedBoardId() === null) {
        this.selectedBoardId.set(firstId);
      }
    });
  }

  // ==== Sidebar: Board selection and add ====

  selectBoard(id: number | null | undefined): void {
    if (typeof id === "number" && this.selectedBoardId() !== id) {
      this.selectedBoardId.set(id);
      this.cancelBoardEdit();
      this.cancelSelectedBoardEdit();
    }
  }

  addBoard(): void {
    if (this.editingBoardId() === null) {
      this.editingBoardId.set(-1); // -1 indicates editing state
      this.editingBoardValue.set("");
      setTimeout(() => {
        const el = document.getElementById(
          "new-board-input"
        ) as HTMLInputElement | null;
        el?.focus();
      });
    }
  }

  onEditBoardInput(event: Event): void {
    this.editingBoardValue.set((event.target as HTMLInputElement).value);
  }

  saveBoardEdit(): void {
    const name = this.editingBoardValue().trim();
    if (!name) {
      this.cancelBoardEdit();
      return;
    }
    this.boardService.createBoard(name).subscribe({
      next: (board) => {
        this.boardService.loadBoards();
        setTimeout(() => {
          if (typeof board.id === "number") {
            this.selectedBoardId.set(board.id);
          }
        }, 300);
      },
      complete: () => this.cancelBoardEdit(),
      error: () => this.cancelBoardEdit(),
    });
  }

  cancelBoardEdit(): void {
    this.editingBoardId.set(null);
    this.editingBoardValue.set("");
  }

  // ==== Board title main area: Edit, Save, Cancel ====

  startSelectedBoardEdit(): void {
    const board = this.getSelectedBoard();
    if (board) {
      this.editingSelectedBoard.set(true);
      this.editingSelectedBoardValue.set(board.name);
      setTimeout(() => {
        const el = document.getElementById(
          "edit-selected-board-input"
        ) as HTMLInputElement | null;
        el?.focus();
      });
    }
  }

  onEditSelectedBoardInput(event: Event): void {
    this.editingSelectedBoardValue.set(
      (event.target as HTMLInputElement).value
    );
  }

  saveSelectedBoardEdit(): void {
    const board = this.getSelectedBoard();
    const newName = this.editingSelectedBoardValue().trim();
    if (!board || !newName || newName === board.name) {
      this.cancelSelectedBoardEdit();
      return;
    }
    this.boardService.updateBoard(board.id!, newName).subscribe({
      next: () => this.boardService.loadBoards(),
      complete: () => this.cancelSelectedBoardEdit(),
      error: () => this.cancelSelectedBoardEdit(),
    });
  }

  cancelSelectedBoardEdit(): void {
    this.editingSelectedBoard.set(false);
    this.editingSelectedBoardValue.set("");
  }

  // ==== Board deletion and global task deletion (with confirm dialogs) ====

  async deleteSelectedBoard(): Promise<void> {
    const board = this.getSelectedBoard();
    if (!board || typeof board.id !== "number") return;
    const confirmed = await this.confirmDialog.open(
      "Delete board",
      `Delete board "${board.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;
    this.boardService.deleteBoard(board.id).subscribe({
      next: () => {
        this.boardService.loadBoards();
        // Auto-select another board if possible
        this.selectedBoardId.set(
          this.boards().find((b) => b.id !== board.id)?.id ?? null
        );
      },
      error: () => alert("Error while deleting board."),
    });
  }

  async deleteAllTasks(): Promise<void> {
    if (this.editingSelectedBoard()) return;
    const selectedBoard = this.getSelectedBoard();
    if (!selectedBoard || typeof selectedBoard.id !== "number") return;

    const confirmed = await this.confirmDialog.open(
      "Board deletion",
      "Are you sure you want to delete all tasks in this board?"
    );
    if (!confirmed) return;

    this.taskService.deleteAllTasksByBoardId(selectedBoard.id).subscribe({
      next: () => this.taskService.loadTasks(),
      error: () => alert("Error while deleting all tasks for this board."),
    });
  }

  // ==== Utility getters ====

  getSelectedBoard() {
    return this.boards().find((b) => b.id === this.selectedBoardId());
  }

  get selectedBoardName(): string {
    return this.getSelectedBoard()?.name ?? "No board selected";
  }
}
