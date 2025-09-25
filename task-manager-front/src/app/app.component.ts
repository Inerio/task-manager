import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  inject,
  signal,
  computed,
  effect,
} from "@angular/core";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { AlertComponent } from "./shared/ui/alert/alert.component";
import { ConfirmDialogComponent } from "./shared/ui/confirm-dialog/confirm-dialog.component";
import { LoadingOverlayComponent } from "./shared/ui/loading-overlay/loading-overlay.component";
import { TemplatePickerComponent } from "./features/template-picker/ui/template-picker.component";
import { BoardComponent } from "./features/board/ui/board/board.component";
import { BoardSidebarComponent } from "./features/board/ui/board-sidebar/board-sidebar.component";
import { BoardToolbarComponent } from "./features/board/ui/board-toolbar/board-toolbar.component";
import { BoardService } from "./features/board/data/board.service";
import { AccountIdDialogComponent } from "./shared/ui/account-id-dialog/account-id-dialog.component";
import { TaskService } from "./features/task/data/task.service";
import { AlertService } from "./core/services/alert.service";
import { RealtimeService } from "./core/services/realtime/realtime.service";

@Component({
  selector: "app-root",
  standalone: true,
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    // root-level singletons
    AlertComponent,
    ConfirmDialogComponent,
    LoadingOverlayComponent,
    TemplatePickerComponent,
    // split components
    BoardSidebarComponent,
    BoardToolbarComponent,
    // existing board view
    BoardComponent,
    // account id dialog for empty-state / global access
    AccountIdDialogComponent,
  ],
})
export class AppComponent implements OnDestroy {
  private readonly boardService = inject(BoardService);
  private readonly taskService = inject(TaskService);
  private readonly alert = inject(AlertService);
  private readonly i18n = inject(TranslocoService);
  private readonly realtime = inject(RealtimeService);

  // Boards list (signal from service)
  readonly boards = this.boardService.boards;
  readonly selectedBoardId = signal<number | null>(null);

  // Derived "has boards" flag
  readonly hasBoards = computed(() => this.boards().length > 0);

  // Responsive flags
  private readonly _mql = window.matchMedia("(max-width: 768px)");
  readonly isMdDown = signal<boolean>(this._mql.matches);
  readonly sidebarOpen = signal<boolean>(true);

  /** Derived selected board name (for toolbar input). */
  readonly selectedBoardName = computed(
    () => this.boards().find((b) => b.id === this.selectedBoardId())?.name ?? ""
  );

  // Footer year
  readonly currentYear = new Date().getFullYear();

  // --- persistence key (scoped) ---
  private readonly STORAGE_KEY = "tasukeru:lastBoardId";

  // Account dialog for empty-state / global access
  readonly showAccountDialog = signal(false);

  constructor() {
    this.boardService.loadBoards();

    // Start global SSE as early as possible
    this.realtime.connectGlobal();

    this._onMqChange = this._onMqChange.bind(this);
    this._mql.addEventListener("change", this._onMqChange);

    effect(() => {
      const boards = this.boards();
      const current = this.selectedBoardId();

      if (boards.length === 0) {
        if (current !== null) this.selectedBoardId.set(null);
        return;
      }

      const currentExists = boards.some((b) => b.id === current);
      if (currentExists) return;

      const saved = this.getSavedBoardId();
      const savedExists =
        typeof saved === "number" && boards.some((b) => b.id === saved);

      const next = (savedExists ? saved : boards[0]!.id!) as number;
      if (current !== next) this.selectedBoardId.set(next);
    });

    // Persist the last opened board id.
    effect(() => {
      const id = this.selectedBoardId();
      try {
        if (typeof id === "number") {
          localStorage.setItem(this.STORAGE_KEY, String(id));
        }
      } catch {}
    });

    // Drawer state based on viewport/data.
    effect(() => {
      const small = this.isMdDown();
      const hasBoards = this.hasBoards();
      const selected = this.selectedBoardId();
      if (!small) {
        this.sidebarOpen.set(true);
      } else {
        this.sidebarOpen.set(!hasBoards || selected === null);
      }
    });

    // Switch board-scoped SSE whenever selection changes
    effect(() => {
      this.realtime.switchBoard(this.selectedBoardId());
    });
  }

  ngOnDestroy(): void {
    this._mql.removeEventListener("change", this._onMqChange);
    this.realtime.destroy();
  }

  private _onMqChange(e: MediaQueryListEvent): void {
    this.isMdDown.set(e.matches);
  }

  /** Read last board id from storage. */
  private getSavedBoardId(): number | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw == null) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }

  // Sidebar controls (mobile/tablet)
  openSidebar(): void {
    if (this.isMdDown()) this.sidebarOpen.set(true);
  }
  closeSidebar(): void {
    if (this.isMdDown() && this.hasBoards()) this.sidebarOpen.set(false);
  }
  onBoardSelected(id: number): void {
    if (this.selectedBoardId() !== id) this.selectedBoardId.set(id);
    if (this.isMdDown()) this.sidebarOpen.set(false);
  }
  onAfterDelete(nextId: number | null): void {
    this.selectedBoardId.set(nextId);
  }

  /** Called when switching ID from the app-level dialog (empty state / global). */
  onUidSwitchedFromApp(_uid: string): void {
    this.showAccountDialog.set(false);
    // Reload everything so the new identity is applied
    this.boardService.loadBoards();
    this.taskService.loadTasks({ force: true });
    this.alert.show("success", this.i18n.translate("identity.switched"));

    // Reconnect global SSE with the new UID, and reset board stream
    this.realtime.destroy();
    this.realtime.connectGlobal();
    this.realtime.switchBoard(this.selectedBoardId());
  }
}
