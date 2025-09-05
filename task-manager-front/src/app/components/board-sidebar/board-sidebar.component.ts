import { CommonModule } from "@angular/common";
import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { LanguageSwitcherComponent } from "../language-switcher/language-switcher.component";
import { ThemeSwitcherComponent } from "../theme-switcher/theme-switcher.component";

import { BoardService } from "../../services/board.service";
import { LoadingService } from "../../services/loading.service";
import { KanbanColumnService } from "../../services/kanban-column.service";
import { TemplatePickerService } from "../../services/template-picker.service";
import { DragDropGlobalService } from "../../services/drag-drop-global.service";

import { applyBoardTemplate } from "../../utils/board-templates";
import {
  getBoardDragData,
  setBoardDragData,
} from "../../utils/drag-drop-utils";

/** Local board typing kept minimal to match existing code. */
type BoardLike = { id?: number | null; name: string };

/** Ephemeral item appended while typing a new board. */
interface TempBoard {
  readonly id: null;
  readonly name: string;
}

@Component({
  selector: "app-board-sidebar",
  standalone: true,
  imports: [
    CommonModule,
    TranslocoModule,
    LanguageSwitcherComponent,
    ThemeSwitcherComponent,
  ],
  templateUrl: "./board-sidebar.component.html",
  styleUrls: ["./board-sidebar.component.scss"],
})
export class BoardSidebarComponent {
  // ---- Inputs / Outputs ----
  /** Whether viewport is below md breakpoint (used to toggle drawer). */
  isMdDown = input<boolean>(false);
  /** Drawer open state (visual only; parent keeps the source of truth). */
  open = input<boolean>(true);
  /** Currently selected board id (for highlight & a11y). */
  selectedId = input<number | null>(null);
  /** Emit when a board is selected (or created). */
  boardSelected = output<number>();
  /** Ask parent to close the drawer on mobile/tablet. */
  requestClose = output<void>();

  // ---- Services ----
  private readonly boardService = inject(BoardService);
  private readonly loading = inject(LoadingService);
  private readonly kanbanColumnService = inject(KanbanColumnService);
  private readonly i18n = inject(TranslocoService);
  private readonly templatePicker = inject(TemplatePickerService);
  private readonly dragDropGlobal = inject(DragDropGlobalService);

  // ---- Template refs ----
  @ViewChild("newBoardInput", { read: ElementRef })
  private newBoardInput?: ElementRef<HTMLInputElement>;

  // ---- State (signals) ----
  readonly boards = this.boardService.boards;
  readonly BOARD_LIMIT = 12;

  readonly editingBoardId = signal<number | null>(null);
  readonly editingBoardValue = signal<string>("");

  readonly dragOverBoardIndex = signal<number | null>(null);
  readonly dropEndOver = signal(false);

  // Displayed list (existing + temporary item while editing).
  readonly displayedBoards = computed<ReadonlyArray<BoardLike | TempBoard>>(
    () => {
      if (this.editingBoardId() === null) return this.boards();
      return [
        ...this.boards(),
        { id: null, name: this.editingBoardValue() } as TempBoard,
      ];
    }
  );

  /** Show “+ Add board” only under the limit (and hide during the Nth creation). */
  readonly canShowAdd = computed(() => {
    const count = this.boards().length;
    const isEditing = this.editingBoardId() !== null;
    return isEditing ? count + 1 < this.BOARD_LIMIT : count < this.BOARD_LIMIT;
  });

  // ---- Sidebar actions ----
  onCloseClicked(): void {
    if (this.isMdDown()) this.requestClose.emit();
  }

  selectBoard(id: number | null | undefined): void {
    if (typeof id !== "number") return;
    this.boardSelected.emit(id);
    if (this.isMdDown()) this.requestClose.emit();
  }

  addBoard(): void {
    if (this.boards().length >= this.BOARD_LIMIT) return;
    if (this.editingBoardId() !== null) return;
    this.editingBoardId.set(-1); // sentinel for "new"
    this.editingBoardValue.set("");
    requestAnimationFrame(() => this.newBoardInput?.nativeElement.focus());
  }

  onEditBoardInput(event: Event): void {
    this.editingBoardValue.set((event.target as HTMLInputElement).value);
  }

  /**
   * Save new board, then open Template Picker and optionally apply the template.
   * Parent selection is updated via (boardSelected) output.
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
        if (newId !== null) this.boardSelected.emit(newId);

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

        if (this.isMdDown()) this.requestClose.emit();
      },
      complete: () => this.cancelBoardEdit(),
      error: () => this.cancelBoardEdit(),
    });
  }

  cancelBoardEdit(): void {
    this.editingBoardId.set(null);
    this.editingBoardValue.set("");
  }

  // ---- DnD (boards) ----
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
}
