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
  ChangeDetectionStrategy,
} from "@angular/core";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { LanguageSwitcherComponent } from "../../../settings/ui/language-switcher/language-switcher.component";
import { ThemeSwitcherComponent } from "../../../settings/ui/theme-switcher/theme-switcher.component";
import { BoardService } from "../../data/board.service";
import { LoadingService } from "../../../../core/services/loading.service";
import { KanbanColumnService } from "../../data/kanban-column.service";
import { TemplatePickerService } from "../../../template-picker/data/template-picker.service";
import { DragDropGlobalService } from "../../../../core/services/dnd/drag-drop-global.service";
import { applyBoardTemplate } from "../../utils/board-templates";
import {
  getBoardDragData,
  setBoardDragData,
} from "../../../../shared/utils/drag-drop-utils";
import { AccountIdDialogComponent } from "../../../../shared/ui/account-id-dialog/account-id-dialog.component";

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
    AccountIdDialogComponent,
  ],
  templateUrl: "./board-sidebar.component.html",
  styleUrls: ["./board-sidebar.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardSidebarComponent {
  // ---- Inputs / Outputs ----
  /** Whether viewport is below md breakpoint (used to toggle drawer). */
  isMdDown = input<boolean>(false);
  /** Drawer open state (visual only; parent keeps the source of truth). */
  open = input<boolean>(true);
  /** Force fullscreen drawer (used when there are no boards on mobile). */
  forceFullscreen = input<boolean>(false);
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

  // Local Account ID dialog state (mobile only)
  readonly showAccountDialog = signal(false);
  // Neutralise sidebar transform/transition before opening dialog
  readonly dialogLayerActive = signal(false);

  // Displayed list.
  readonly displayedBoards = computed<ReadonlyArray<BoardLike | TempBoard>>(
    () => {
      if (this.editingBoardId() === null) return this.boards();
      return [
        ...this.boards(),
        { id: null, name: this.editingBoardValue() } as TempBoard,
      ];
    }
  );

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
    this.editingBoardId.set(-1);
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

  // ===== Account ID dialog handling =====
  openAccountDialog(): void {
    if (!this.isMdDown()) {
      this.showAccountDialog.set(true);
      return;
    }
    this.dialogLayerActive.set(true);
    requestAnimationFrame(() => {
      this.showAccountDialog.set(true);
    });
  }

  onCloseDialog(): void {
    this.showAccountDialog.set(false);
    // Let the dialog close visually, then restore sidebar transitions
    requestAnimationFrame(() => this.dialogLayerActive.set(false));
  }

  /** Reload boards after switching ID from the sidebar dialog. */
  onUidSwitchedFromSidebar(_uid: string): void {
    this.onCloseDialog();
    this.boardService.loadBoards();
  }
}
