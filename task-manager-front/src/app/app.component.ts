import {
  Component,
  OnDestroy,
  ViewChild,
  ElementRef,
  inject,
  signal,
  computed,
  effect,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslocoModule } from "@jsverse/transloco";

import { AlertComponent } from "./components/alert/alert.component";
import { ConfirmDialogComponent } from "./components/alert/confirm-dialog.component";
import { LoadingOverlayComponent } from "./components/loading-overlay/loading-overlay.component";
import { TemplatePickerComponent } from "./components/template-picker/template-picker.component";
import { BoardComponent } from "./components/board/board.component";

import { BoardSidebarComponent } from "./components/board-sidebar/board-sidebar.component";
import { BoardToolbarComponent } from "./components/board-toolbar/board-toolbar.component";

import { BoardService } from "./services/board.service";

@Component({
  selector: "app-root",
  standalone: true,
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
  imports: [
    CommonModule,
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
  ],
})
export class AppComponent implements OnDestroy {
  private readonly boardService = inject(BoardService);

  // Boards list (signal from service)
  readonly boards = this.boardService.boards;
  readonly selectedBoardId = signal<number | null>(null);

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

  constructor() {
    this.boardService.loadBoards();

    this._onMqChange = this._onMqChange.bind(this);
    this._mql.addEventListener("change", this._onMqChange);

    // Auto-select first board once loaded (if none selected yet).
    effect(() => {
      const firstId = this.boards()[0]?.id;
      if (typeof firstId === "number" && this.selectedBoardId() === null) {
        this.selectedBoardId.set(firstId);
      }
    });

    // Drawer state based on viewport/data.
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

  // Sidebar controls (mobile/tablet)
  openSidebar(): void {
    if (this.isMdDown()) this.sidebarOpen.set(true);
  }
  closeSidebar(): void {
    if (this.isMdDown()) this.sidebarOpen.set(false);
  }

  // Child -> parent events
  onBoardSelected(id: number): void {
    if (this.selectedBoardId() !== id) this.selectedBoardId.set(id);
    if (this.isMdDown()) this.sidebarOpen.set(false);
  }
  onAfterDelete(nextId: number | null): void {
    this.selectedBoardId.set(nextId);
  }
}
