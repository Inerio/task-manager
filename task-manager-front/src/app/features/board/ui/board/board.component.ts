import {
  Component,
  Input,
  inject,
  signal,
  effect,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
} from "@angular/core";
import { LoadingOverlayComponent } from "../../../../shared/ui/loading-overlay/loading-overlay.component";
import { BoardColumnsComponent } from "../board-columns/board-columns.component";
import { KanbanColumnService } from "../../data/kanban-column.service";
import { TaskService } from "../../../task/data/task.service";

@Component({
  selector: "app-board",
  standalone: true,
  templateUrl: "./board.component.html",
  styleUrls: ["./board.component.scss"],
  imports: [LoadingOverlayComponent, BoardColumnsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardComponent implements OnChanges {
  @Input({ required: true }) boardId!: number;

  private readonly _boardId = signal<number | null>(null);

  private readonly kanbanColumnService = inject(KanbanColumnService);
  private readonly taskService = inject(TaskService);

  constructor() {
    effect(() => {
      const id = this._boardId();
      if (id != null) {
        this.kanbanColumnService.loadKanbanColumns(id);
        this.taskService.loadTasks({ force: true });
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["boardId"] && typeof this.boardId === "number") {
      this._boardId.set(this.boardId);
    }
  }
}
