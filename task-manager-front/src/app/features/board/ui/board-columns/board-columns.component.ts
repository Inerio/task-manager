import { Component, Input, computed, inject } from "@angular/core";
import { TranslocoModule } from "@jsverse/transloco";
import { KanbanColumnComponent } from "../kanban-column/kanban-column.component";
import { KanbanColumnService } from "../../data/kanban-column.service";
import { TaskService } from "../../../task/data/task.service";
import { KanbanColumn } from "../../models/kanban-column.model";
import { BoardColumnsDndService } from "../../data/board-columns-dnd.service";
import { BoardColumnsEditService } from "../../data/board-columns-edit.service";

/**
 * BoardColumns: light orchestrator that composes two scoped services:
 * - BoardColumnsDndService (drag/drop state + move persistence)
 * - BoardColumnsEditService (inline edit + CRUD)
 * Strict 1:1 feature parity with the original monolithic component.
 */
@Component({
  selector: "app-board-columns",
  standalone: true,
  templateUrl: "./board-columns.component.html",
  styleUrls: ["./board-columns.component.scss"],
  imports: [TranslocoModule, KanbanColumnComponent],
  providers: [BoardColumnsDndService, BoardColumnsEditService],
})
export class BoardColumnsComponent {
  @Input({ required: true }) boardId!: number;

  private readonly columns = inject(KanbanColumnService);
  private readonly tasks = inject(TaskService);

  // Expose services to the template
  readonly dnd = inject(BoardColumnsDndService);
  readonly edit = inject(BoardColumnsEditService);

  /** True if the board has at least one task (Set for O(1) lookups). */
  readonly hasAnyTask = computed(() => {
    const columnIds = new Set(this.columns.kanbanColumns().map((c) => c.id));
    return this.tasks.tasks().some((t) => columnIds.has(t.kanbanColumnId));
  });

  /** Displayed columns; while dragging, show the in-flight order. */
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

  /** Expose the limit for the template (kept identical). */
  readonly MAX_COLUMNS = this.edit.MAX_COLUMNS;

  // ---- Template helpers (tiny, unchanged behavior)
  trackByColumnId(index: number, col: KanbanColumn): number | string {
    return typeof col.id === "number" ? col.id : `draft-${index}`;
  }
  isEditingTitle(column: KanbanColumn): boolean {
    return this.edit.editingColumn() === column;
  }
  isDraft(column: KanbanColumn): boolean {
    return !column.id;
  }
}
