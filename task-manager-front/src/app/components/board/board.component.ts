import {
  Component,
  Input,
  inject,
  signal,
  effect,
  OnChanges,
  SimpleChanges,
} from "@angular/core";
import { LoadingOverlayComponent } from "../loading-overlay/loading-overlay.component";
import { BoardColumnsComponent } from "../board-columns/board-columns.component";
import { KanbanColumnService } from "../../services/kanban-column.service";
import { TaskService } from "../../services/task.service";

/**
 * Board container: loads data + shows scoped overlay.
 * All UI (grid, DnD, inline edit) is delegated to BoardColumnsComponent.
 */
@Component({
  selector: "app-board",
  standalone: true,
  templateUrl: "./board.component.html",
  styleUrls: ["./board.component.scss"],
  imports: [LoadingOverlayComponent, BoardColumnsComponent],
})
export class BoardComponent implements OnChanges {
  @Input({ required: true }) boardId!: number;

  private readonly _boardId = signal<number | null>(null);

  private readonly kanbanColumnService = inject(KanbanColumnService);
  private readonly taskService = inject(TaskService);

  constructor() {
    // Load columns + tasks when boardId changes.
    effect(() => {
      const id = this._boardId();
      if (id != null) {
        this.kanbanColumnService.loadKanbanColumns(id);
        // Service guards repeated loads internally.
        this.taskService.loadTasks();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["boardId"] && typeof this.boardId === "number") {
      this._boardId.set(this.boardId);
    }
  }
}
