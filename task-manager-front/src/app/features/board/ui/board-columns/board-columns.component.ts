import {
  Component,
  Input,
  computed,
  inject,
  ChangeDetectionStrategy,
} from "@angular/core";
import { TranslocoModule } from "@jsverse/transloco";
import { KanbanColumnComponent } from "../kanban-column/kanban-column.component";
import { KanbanColumnService } from "../../data/kanban-column.service";
import { TaskService } from "../../../task/data/task.service";
import { KanbanColumn } from "../../models/kanban-column.model";
import { BoardColumnsDndService } from "../../data/board-columns-dnd.service";
import { BoardColumnsEditService } from "../../data/board-columns-edit.service";
import { AutofocusOnInitDirective } from "../../../../shared/directives/autofocus-on-init.directive";
import { BoardHorizontalAutoScrollDirective } from "../../directives/board-horizontal-autoscroll.directive";

@Component({
  selector: "app-board-columns",
  standalone: true,
  templateUrl: "./board-columns.component.html",
  styleUrls: ["./board-columns.component.scss"],
  imports: [
    TranslocoModule,
    KanbanColumnComponent,
    AutofocusOnInitDirective,
    BoardHorizontalAutoScrollDirective,
  ],
  providers: [BoardColumnsDndService, BoardColumnsEditService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardColumnsComponent {
  @Input({ required: true }) boardId!: number;

  private readonly columns = inject(KanbanColumnService);
  private readonly tasks = inject(TaskService);

  readonly dnd = inject(BoardColumnsDndService);
  readonly edit = inject(BoardColumnsEditService);

  readonly hasAnyTask = computed(() => {
    const columnIds = new Set(this.columns.kanbanColumns().map((c) => c.id));
    return this.tasks.tasks().some((t) => columnIds.has(t.kanbanColumnId));
  });

  readonly kanbanColumns = computed(() => {
    const raw = this.columns.kanbanColumns();
    const draggedId = this.dnd.draggedKanbanColumnId();
    const overIdx = this.dnd.dragOverIndex();
    if (draggedId == null || overIdx == null) return raw;

    const currIdx = raw.findIndex((c) => c.id === draggedId);
    if (currIdx === -1 || currIdx === overIdx) return raw;

    const copy = raw.slice();
    const [dragged] = copy.splice(currIdx, 1);
    copy.splice(overIdx, 0, dragged);
    return copy;
  });

  readonly MAX_COLUMNS = this.edit.MAX_COLUMNS;

  trackByColumnId(index: number, col: KanbanColumn): number | string {
    return typeof col.id === "number" ? col.id : `draft-${index}`;
  }

  isEditingTitle(column: KanbanColumn): boolean {
    const editing = this.edit.editingColumn();
    if (!editing) return false;
    if (editing.id != null && column.id != null)
      return editing.id === column.id;
    if (editing.id == null && column.id == null) return true;
    return editing === column;
  }
}
