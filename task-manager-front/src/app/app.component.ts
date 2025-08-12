import { Component, signal, inject, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { AlertComponent } from "./components/alert/alert.component";
import { ConfirmDialogComponent } from "./components/alert/confirm-dialog.component";
import { BoardComponent } from "./components/board/board.component";
import { BoardService } from "./services/board.service";
import { ConfirmDialogService } from "./services/confirm-dialog.service";
import { TaskService } from "./services/task.service";
import { LoadingOverlayComponent } from "./components/loading-overlay/loading-overlay.component";
import { LoadingService } from "./services/loading.service";
import { KanbanColumnService } from "./services/kanban-column.service";
import { LanguageSwitcherComponent } from "./components/language-switcher/language-switcher.component";
import { ThemeSwitcherComponent } from "./components/theme-switcher/theme-switcher.component";
import { TemplatePickerComponent } from "./components/template-picker/template-picker.component";
import { TemplatePickerService } from "./services/template-picker.service";
import { applyBoardTemplate } from "./utils/board-templates";

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
    TranslocoModule,
    AlertComponent,
    ConfirmDialogComponent,
    BoardComponent,
    LoadingOverlayComponent,
    LanguageSwitcherComponent,
    ThemeSwitcherComponent,
    TemplatePickerComponent,
  ],
})
export class AppComponent {
  private readonly boardService = inject(BoardService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly taskService = inject(TaskService);
  private readonly loading = inject(LoadingService);
  private readonly kanbanColumnService = inject(KanbanColumnService);
  private readonly i18n = inject(TranslocoService);
  private readonly templatePicker = inject(TemplatePickerService);

  readonly boards = this.boardService.boards;
  readonly selectedBoardId = signal<number | null>(null);

  /** Inline add board state */
  readonly editingBoardId = signal<number | null>(null);
  readonly editingBoardValue = signal<string>("");

  /** Edit mode for selected board title (main area) */
  readonly editingSelectedBoard = signal<boolean>(false);
  readonly editingSelectedBoardValue = signal<string>("");

  /** Footer year */
  readonly currentYear = new Date().getFullYear();

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
    // Auto select first board
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
      this.editingBoardId.set(-1);
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

  /**
   * Save new board, then open the Template Picker.
   * If a template is chosen, create its columns (localized) via the service.
   */
  saveBoardEdit(): void {
    const name = this.editingBoardValue().trim();
    if (!name) {
      this.cancelBoardEdit();
      return;
    }

    this.loading.wrap$(this.boardService.createBoard(name)).subscribe({
      next: async (board) => {
        this.boardService.loadBoards();
        const newId = typeof board.id === "number" ? board.id : null;
        if (newId !== null) this.selectedBoardId.set(newId);

        // ---- Open template picker ----
        const chosenTemplate = await this.templatePicker.open();
        if (chosenTemplate && newId !== null) {
          await this.loading.wrap(
            applyBoardTemplate(
              this.kanbanColumnService,
              newId,
              chosenTemplate,
              this.i18n
            )
          );
          this.kanbanColumnService.loadKanbanColumns(newId);
        }
      },
      complete: () => this.cancelBoardEdit(),
      error: () => this.cancelBoardEdit(),
    });
  }

  cancelBoardEdit(): void {
    this.editingBoardId.set(null);
    this.editingBoardValue.set("");
  }

  // ==== Board title main area ====
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

  // ==== Board deletion and global task deletion ====
  async deleteSelectedBoard(): Promise<void> {
    const board = this.getSelectedBoard();
    if (!board || typeof board.id !== "number") return;
    const confirmed = await this.confirmDialog.open(
      this.i18n.translate("boards.delete"),
      this.i18n.translate("boards.deleteBoardConfirm", { name: board.name })
    );
    if (!confirmed) return;
    this.boardService.deleteBoard(board.id).subscribe({
      next: () => {
        this.boardService.loadBoards();
        this.selectedBoardId.set(
          this.boards().find((b) => b.id !== board.id)?.id ?? null
        );
      },
      error: () => alert(this.i18n.translate("errors.deletingBoard")),
    });
  }

  async deleteAllTasks(): Promise<void> {
    if (this.editingSelectedBoard()) return;
    const selectedBoard = this.getSelectedBoard();
    if (!selectedBoard || typeof selectedBoard.id !== "number") return;

    const confirmed = await this.confirmDialog.open(
      this.i18n.translate("boards.deleteAllTitle"),
      this.i18n.translate("boards.deleteAllConfirm")
    );
    if (!confirmed) return;

    this.taskService
      .deleteAllTasksByBoardId(selectedBoard.id)
      .then(() => this.taskService.loadTasks({ force: true }))
      .catch(() =>
        alert(this.i18n.translate("errors.deletingAllTasksForBoard"))
      );
  }

  // ==== Utils ====
  getSelectedBoard() {
    return this.boards().find((b) => b.id === this.selectedBoardId());
  }

  get selectedBoardName(): string {
    return this.getSelectedBoard()?.name ?? "No board selected";
  }
}
