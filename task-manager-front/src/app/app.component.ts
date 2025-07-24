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
  private readonly boardService = inject(BoardService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly taskService = inject(TaskService);
  readonly boards = this.boardService.boards;
  selectedBoardId = signal<number | null>(null);

  /** Temporary editing state for new board creation */
  editingBoardId = signal<number | null>(null);
  editingBoardValue = signal<string>("");

  /** Edit mode for the selected board's title (main area) */
  editingSelectedBoard = signal<boolean>(false);
  editingSelectedBoardValue = signal<string>("");

  /** Temporary board list for displaying a new board being created */
  readonly displayedBoards = computed(() => {
    // If a board is being created, append it (id === null)
    if (this.editingBoardId() === null) return this.boards();
    return [
      ...this.boards(),
      { id: null, name: this.editingBoardValue() } as TempBoard,
    ];
  });

  constructor() {
    this.boardService.loadBoards();

    // Automatically select the first board after loading, if any
    computed(() => {
      const firstId = this.boards()[0]?.id;
      if (typeof firstId === "number" && this.selectedBoardId() === null) {
        this.selectedBoardId.set(firstId);
      }
    });
  }

  selectBoard(id: number | null | undefined) {
    if (typeof id === "number" && this.selectedBoardId() !== id) {
      this.selectedBoardId.set(id);
      this.cancelBoardEdit(); // Cancel any add-board in progress if switching
      this.cancelSelectedBoardEdit(); // Cancel edit mode if switching
    }
  }

  /** Start inline board creation (adds a temp board to the list) */
  addBoard() {
    if (this.editingBoardId() === null) {
      this.editingBoardId.set(-1); // Use -1 to indicate a temp "edit" state
      this.editingBoardValue.set("");
      setTimeout(() => {
        // Focus on the input (timeout for DOM rendering)
        const el = document.getElementById(
          "new-board-input"
        ) as HTMLInputElement | null;
        el?.focus();
      });
    }
  }

  /** When editing board name input changes */
  onEditBoardInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.editingBoardValue.set(val);
  }

  /** Save the new board to API and update the list */
  saveBoardEdit() {
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

  /** Cancel board creation (removes the temp board input) */
  cancelBoardEdit() {
    this.editingBoardId.set(null);
    this.editingBoardValue.set("");
  }

  /** === BOARD TITLE MAIN AREA EDITION === */
  startSelectedBoardEdit() {
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

  onEditSelectedBoardInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.editingSelectedBoardValue.set(val);
  }

  saveSelectedBoardEdit() {
    const board = this.getSelectedBoard();
    const newName = this.editingSelectedBoardValue().trim();
    if (!board || !newName || newName === board.name) {
      this.cancelSelectedBoardEdit();
      return;
    }
    this.boardService.updateBoard(board.id!, newName).subscribe({
      next: () => {
        this.boardService.loadBoards();
      },
      complete: () => this.cancelSelectedBoardEdit(),
      error: () => this.cancelSelectedBoardEdit(),
    });
  }

  cancelSelectedBoardEdit() {
    this.editingSelectedBoard.set(false);
    this.editingSelectedBoardValue.set("");
  }

  /** Delete the currently selected board with confirm dialog */
  async deleteSelectedBoard() {
    const board = this.getSelectedBoard();
    if (!board || typeof board.id !== "number") return;
    // Use ConfirmDialog
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

  /** Handler for "Delete all tasks" (top-right of board header) */
  async deleteAllTasks() {
    if (this.editingSelectedBoard()) return;
    const selectedBoard = this.getSelectedBoard();
    if (!selectedBoard || typeof selectedBoard.id !== "number") return;

    const confirmed = await this.confirmDialog.open(
      "Board deletion",
      "Are you sure you want to delete all tasks in this board?"
    );
    if (!confirmed) return;

    // Call new service method for board-specific deletion
    this.taskService.deleteAllTasksByBoardId(selectedBoard.id).subscribe({
      next: () => this.taskService.loadTasks(),
      error: (err) => alert("Error while deleting all tasks for this board."),
    });
  }

  /** Returns the currently selected board object */
  getSelectedBoard() {
    return this.boards().find((b) => b.id === this.selectedBoardId());
  }

  get selectedBoardName(): string {
    const board = this.getSelectedBoard();
    return board?.name ?? "No board selected";
  }
}
