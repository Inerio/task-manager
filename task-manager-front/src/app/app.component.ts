import {
  Component,
  signal,
  inject,
  computed,
  effect,
  ViewChild,
  ElementRef,
  OnDestroy,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";

import { AlertComponent } from "./components/alert/alert.component";
import { ConfirmDialogComponent } from "./components/alert/confirm-dialog.component";
import { LanguageSwitcherComponent } from "./components/language-switcher/language-switcher.component";
import { ThemeSwitcherComponent } from "./components/theme-switcher/theme-switcher.component";
import { LoadingOverlayComponent } from "./components/loading-overlay/loading-overlay.component";
import { BoardComponent } from "./components/board/board.component";
import { TemplatePickerComponent } from "./components/template-picker/template-picker.component";

import { BoardService } from "./services/board.service";
import { ConfirmDialogService } from "./services/confirm-dialog.service";
import { TaskService } from "./services/task.service";
import { LoadingService } from "./services/loading.service";
import { KanbanColumnService } from "./services/kanban-column.service";
import { TemplatePickerService } from "./services/template-picker.service";
import { DragDropGlobalService } from "./services/drag-drop-global.service";
import { AlertService } from "./services/alert.service";

import { applyBoardTemplate } from "./utils/board-templates";
import { getBoardDragData, setBoardDragData } from "./utils/drag-drop-utils";

/** Minimal local typing for boards to improve readability. */
type BoardLike = { id?: number | null; name: string };

/** Ephemeral item appended when typing a new board name. */
interface TempBoard {
  readonly id: null;
  readonly name: string;
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
export class AppComponent implements OnDestroy {
  // ===== Services =====
  private readonly boardService = inject(BoardService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly taskService = inject(TaskService);
  private readonly loading = inject(LoadingService);
  private readonly kanbanColumnService = inject(KanbanColumnService);
  private readonly i18n = inject(TranslocoService);
  private readonly templatePicker = inject(TemplatePickerService);
  private readonly dragDropGlobal = inject(DragDropGlobalService);
  private readonly alert = inject(AlertService);

  // ===== Template refs (for focus management) =====
  @ViewChild("newBoardInput", { read: ElementRef })
  private newBoardInput?: ElementRef<HTMLInputElement>;
  @ViewChild("editSelectedBoardInput", { read: ElementRef })
  private editSelectedBoardInput?: ElementRef<HTMLInputElement>;

  // ===== State (signals) =====
  readonly boards = this.boardService.boards; // Signal<Array<BoardLike>>
  readonly selectedBoardId = signal<number | null>(null);

  /** Responsive flag: true when viewport < md (matches SCSS $bp-md). */
  private readonly _mql = window.matchMedia("(max-width: 768px)");
  readonly isMdDown = signal<boolean>(this._mql.matches);

  /** Drawer state (used only on mobile/tablet). */
  readonly sidebarOpen = signal<boolean>(true);

  /** Max number of boards allowed in the sidebar. */
  readonly BOARD_LIMIT = 12;

  /** Inline add board state. */
  readonly editingBoardId = signal<number | null>(null);
  readonly editingBoardValue = signal<string>("");

  /** Edit mode for selected board title (main area). */
  readonly editingSelectedBoard = signal<boolean>(false);
  readonly editingSelectedBoardValue = signal<string>("");

  /** Footer year. */
  readonly currentYear = new Date().getFullYear();

  /** DnD UI state for boards list. */
  readonly dragOverBoardIndex = signal<number | null>(null);
  readonly dropEndOver = signal(false);

  /** Displayed boards (existing + temporary item while editing). */
  readonly displayedBoards = computed<ReadonlyArray<BoardLike | TempBoard>>(
    () => {
      if (this.editingBoardId() === null) return this.boards();
      return [
        ...this.boards(),
        { id: null, name: this.editingBoardValue() } as TempBoard,
      ];
    }
  );

  /**
   * Show "+ Add Board" only when under the limit.
   * Also hide it *during* the creation of the Nth board if N reaches the limit.
   */
  readonly canShowAdd = computed(() => {
    const count = this.boards().length;
    const isEditing = this.editingBoardId() !== null;
    if (isEditing) return count + 1 < this.BOARD_LIMIT;
    return count < this.BOARD_LIMIT;
  });

  // ===== Lifecycle =====
  constructor() {
    this.boardService.loadBoards();

    // Keep isMdDown reactive with the media query.
    this._onMqChange = this._onMqChange.bind(this); // stable ref for add/remove
    this._mql.addEventListener("change", this._onMqChange);

    // Auto-select the first board once boards are loaded (only if none selected).
    effect(() => {
      const firstId = this.boards()[0]?.id;
      if (typeof firstId === "number" && this.selectedBoardId() === null) {
        this.selectedBoardId.set(firstId);
      }
    });

    // Default drawer state depending on viewport and data.
    // Mobile/tablet: open if no boards or no selection; otherwise closed.
    // Desktop: always "open" (sidebar is docked).
    effect(() => {
      const small = this.isMdDown();
      const hasBoards = this.boards().length > 0;
      const selected = this.selectedBoardId();
      if (!small) {
        this.sidebarOpen.set(true);
      } else {
        this.sidebarOpen.set(!hasBoards || selected === null);
      }
    });
  }

  ngOnDestroy(): void {
    this._mql.removeEventListener("change", this._onMqChange);
  }

  private _onMqChange(e: MediaQueryListEvent): void {
    this.isMdDown.set(e.matches);
  }

  // ===== Sidebar open/close (mobile/tablet only) =====
  openSidebar(): void {
    if (this.isMdDown()) this.sidebarOpen.set(true);
  }
  closeSidebar(): void {
    if (this.isMdDown()) this.sidebarOpen.set(false);
  }

  // ===== Sidebar: board selection & inline add =====
  selectBoard(id: number | null | undefined): void {
    if (typeof id === "number" && this.selectedBoardId() !== id) {
      this.selectedBoardId.set(id);
      this.cancelBoardEdit();
      this.cancelSelectedBoardEdit();
      // Auto-close drawer after selection on small screens.
      if (this.isMdDown()) this.sidebarOpen.set(false);
    }
  }

  addBoard(): void {
    if (this.boards().length >= this.BOARD_LIMIT) return;
    if (this.editingBoardId() !== null) return;

    this.editingBoardId.set(-1); // sentinel value = "editing new board"
    this.editingBoardValue.set("");

    // Focus the inline input on next frame when it is in the DOM.
    requestAnimationFrame(() => this.newBoardInput?.nativeElement.focus());
  }

  onEditBoardInput(event: Event): void {
    this.editingBoardValue.set((event.target as HTMLInputElement).value);
  }

  /**
   * Save new board, then open the Template Picker.
   * If a template is chosen, create its columns via the service.
   * Drawer auto-closes on mobile *after* creation/template apply.
   */
  saveBoardEdit(): void {
    const name = this.editingBoardValue().trim();
    if (!name || this.boards().length >= this.BOARD_LIMIT) {
      this.cancelBoardEdit();
      return;
    }

    this.loading.wrap$(this.boardService.createBoard(name)).subscribe({
      next: async (board) => {
        this.boardService.loadBoards();
        const newId = typeof board.id === "number" ? board.id : null;
        if (newId !== null) this.selectedBoardId.set(newId);

        // Open template picker and apply if chosen.
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

        // Close drawer once creation flow is finished (mobile/tablet).
        if (this.isMdDown()) this.sidebarOpen.set(false);
      },
      complete: () => this.cancelBoardEdit(),
      error: () => this.cancelBoardEdit(),
    });
  }

  cancelBoardEdit(): void {
    this.editingBoardId.set(null);
    this.editingBoardValue.set("");
  }

  // ===== DnD: boards =====
  onBoardDragStart(event: DragEvent, boardId: number): void {
    if (this.editingBoardId() !== null) return;
    setBoardDragData(event, boardId);
    this.dragDropGlobal.startBoardDrag(boardId);
  }

  onBoardDragOver(event: DragEvent, targetIndex: number): void {
    if (!this.dragDropGlobal.isBoardDrag()) return;
    event.preventDefault();
    if (this.dragOverBoardIndex() !== targetIndex) {
      this.dragOverBoardIndex.set(targetIndex);
    }
  }

  onBoardDragLeave(targetIndex?: number): void {
    if (this.dragOverBoardIndex() === targetIndex) {
      this.dragOverBoardIndex.set(null);
    }
  }

  onBoardDrop(event: DragEvent, targetIndex: number): void {
    if (!this.dragDropGlobal.isBoardDrag()) return;

    // Fallback: on some mobile engines DataTransfer can be empty.
    const boardId =
      getBoardDragData(event)?.boardId ??
      this.dragDropGlobal.currentBoardDrag()?.boardId ??
      null;
    if (boardId == null) return;

    event.preventDefault();

    const current = [...this.boards()];
    const fromIdx = current.findIndex((b) => b.id === boardId);
    if (fromIdx === -1) return;

    const [moved] = current.splice(fromIdx, 1);
    current.splice(targetIndex, 0, moved);

    this.boardService.reorderBoardsLocal(current);
    const payload = current.map((b, idx) => ({ id: b.id!, position: idx }));
    this.boardService.reorderBoards(payload).subscribe({
      error: () => this.boardService.loadBoards(),
    });

    this.dragOverBoardIndex.set(null);
    this.dragDropGlobal.endDrag();
  }

  onBoardDragOverEnd(event: DragEvent): void {
    if (!this.dragDropGlobal.isBoardDrag()) return;
    event.preventDefault();
    this.dropEndOver.set(true);
  }

  onBoardDragLeaveEnd(): void {
    this.dropEndOver.set(false);
  }

  onBoardDropEnd(event: DragEvent): void {
    if (!this.dragDropGlobal.isBoardDrag()) return;

    // Fallback to global context if DataTransfer is empty.
    const boardId =
      getBoardDragData(event)?.boardId ??
      this.dragDropGlobal.currentBoardDrag()?.boardId ??
      null;
    if (boardId == null) return;

    event.preventDefault();

    const current = [...this.boards()];
    const fromIdx = current.findIndex((b) => b.id === boardId);
    if (fromIdx === -1) return;

    const [moved] = current.splice(fromIdx, 1);
    current.push(moved);

    this.boardService.reorderBoardsLocal(current);
    const payload = current.map((b, idx) => ({ id: b.id!, position: idx }));
    this.boardService.reorderBoards(payload).subscribe({
      complete: () => this.dropEndOver.set(false),
      error: () => {
        this.dropEndOver.set(false);
        this.boardService.loadBoards();
      },
    });

    this.dragDropGlobal.endDrag();
  }

  // ===== Board title (main area) =====
  startSelectedBoardEdit(): void {
    const board = this.getSelectedBoard();
    if (!board) return;

    this.editingSelectedBoard.set(true);
    this.editingSelectedBoardValue.set(board.name);

    // Focus the title input on next frame when it is in the DOM.
    requestAnimationFrame(() =>
      this.editSelectedBoardInput?.nativeElement.focus()
    );
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

  // ===== Destructive actions =====
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
      error: () =>
        this.alert.show("error", this.i18n.translate("errors.deletingBoard")),
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
        this.alert.show(
          "error",
          this.i18n.translate("errors.deletingAllTasksForBoard")
        )
      );
  }

  // ===== Utils =====
  getSelectedBoard(): BoardLike | undefined {
    return this.boards().find((b) => b.id === this.selectedBoardId());
  }

  get selectedBoardName(): string {
    // Only used when a board is selected; fallback is never shown in UI.
    return this.getSelectedBoard()?.name ?? "No board selected";
  }
}
