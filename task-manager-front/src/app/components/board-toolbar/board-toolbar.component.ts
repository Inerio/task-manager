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
import { CommonModule } from "@angular/common";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { ConfirmDialogService } from "../../services/confirm-dialog.service";
import { TaskService } from "../../services/task.service";
import { AlertService } from "../../services/alert.service";
import { BoardService } from "../../services/board.service";

@Component({
  selector: "app-board-toolbar",
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  templateUrl: "./board-toolbar.component.html",
  styleUrls: ["./board-toolbar.component.scss"],
})
export class BoardToolbarComponent {
  // ---- Inputs / Outputs ----
  isMdDown = input<boolean>(false);
  boardId = input.required<number>();
  boardName = input<string>("");

  /** Ask parent to open the sidebar (burger). */
  requestOpenSidebar = output<void>();
  /** Inform parent which board should become selected after deletion. */
  boardChangeAfterDelete = output<number | null>();

  // ---- Services ----
  private readonly i18n = inject(TranslocoService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly taskService = inject(TaskService);
  private readonly alert = inject(AlertService);
  private readonly boardService = inject(BoardService);

  // ---- Local edit state ----
  readonly editingSelectedBoard = signal(false);
  readonly editingSelectedBoardValue = signal<string>("");

  @ViewChild("editSelectedBoardInput", { read: ElementRef })
  private editSelectedBoardInput?: ElementRef<HTMLInputElement>;

  // ---- Derived name (refresh if list updates) ----
  readonly resolvedName = computed(() => {
    const id = this.boardId();
    if (!id) return this.boardName();
    return (
      this.boardService.boards().find((b) => b.id === id)?.name ??
      this.boardName()
    );
  });

  // ---- UI actions ----
  openSidebar(): void {
    if (this.isMdDown()) this.requestOpenSidebar.emit();
  }

  startSelectedBoardEdit(): void {
    this.editingSelectedBoard.set(true);
    this.editingSelectedBoardValue.set(this.resolvedName());
    // Focus next frame when input is in the DOM.
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
    const id = this.boardId();
    const newName = this.editingSelectedBoardValue().trim();
    const current = this.resolvedName();
    if (!id || !newName || newName === current) {
      this.cancelSelectedBoardEdit();
      return;
    }
    this.boardService.updateBoard(id, newName).subscribe({
      next: () => this.boardService.loadBoards(),
      complete: () => this.cancelSelectedBoardEdit(),
      error: () => this.cancelSelectedBoardEdit(),
    });
  }

  cancelSelectedBoardEdit(): void {
    this.editingSelectedBoard.set(false);
    this.editingSelectedBoardValue.set("");
  }

  async deleteSelectedBoard(): Promise<void> {
    const id = this.boardId();
    const name = this.resolvedName();
    if (!id) return;

    const confirmed = await this.confirmDialog.open(
      this.i18n.translate("boards.delete"),
      this.i18n.translate("boards.deleteBoardConfirm", { name })
    );
    if (!confirmed) return;

    this.boardService.deleteBoard(id).subscribe({
      next: () => {
        // compute next selection locally, then let parent set it
        const next =
          this.boardService.boards().find((b) => b.id !== id)?.id ?? null;
        this.boardService.loadBoards();
        this.boardChangeAfterDelete.emit(next);
      },
      error: () =>
        this.alert.show("error", this.i18n.translate("errors.deletingBoard")),
    });
  }

  async deleteAllTasks(): Promise<void> {
    const id = this.boardId();
    if (!id || this.editingSelectedBoard()) return;

    const confirmed = await this.confirmDialog.open(
      this.i18n.translate("boards.deleteAllTitle"),
      this.i18n.translate("boards.deleteAllConfirm")
    );
    if (!confirmed) return;

    this.taskService
      .deleteAllTasksByBoardId(id)
      .then(() => this.taskService.loadTasks({ force: true }))
      .catch(() =>
        this.alert.show(
          "error",
          this.i18n.translate("errors.deletingAllTasksForBoard")
        )
      );
  }
}
