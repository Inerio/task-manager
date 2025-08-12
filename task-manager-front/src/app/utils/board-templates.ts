import { TranslocoService } from "@jsverse/transloco";
import { KanbanColumnService } from "../services/kanban-column.service";

/** Identifier for the available templates. */
export type BoardTemplateId = "t1" | "t2" | "t3" | "t4" | "t5";

/** Column translation keys living under boards.columns.* */
type ColKey =
  | "inbox"
  | "todo"
  | "inProgress"
  | "done"
  | "today"
  | "thisWeek"
  | "ideas"
  | "review";

export interface BoardTemplateDef {
  id: BoardTemplateId;
  /** Translation keys under boards.columns.* */
  columns: ColKey[];
  /** i18n key for the small description (optional). */
  descKey?: string;
}

/** Static definitions independent from the UI language. */
export const BOARD_TEMPLATES: Readonly<BoardTemplateDef[]> = [
  { id: "t1", columns: ["inbox"], descKey: "boards.templates.t1Desc" },
  {
    id: "t2",
    columns: ["todo", "done"],
    descKey: "boards.templates.t2Desc",
  },
  {
    id: "t3",
    columns: ["todo", "inProgress", "done"],
    descKey: "boards.templates.t3Desc",
  },
  {
    id: "t4",
    columns: ["inbox", "today", "thisWeek", "done"],
    descKey: "boards.templates.t4Desc",
  },
  {
    id: "t5",
    columns: ["ideas", "todo", "inProgress", "review", "done"],
    descKey: "boards.templates.t5Desc",
  },
] as const;

/**
 * Apply a template to a given board:
 * - Translates each column name
 * - Creates them in order via KanbanColumnService
 */
export async function applyBoardTemplate(
  columnService: KanbanColumnService,
  boardId: number,
  templateId: BoardTemplateId,
  i18n: TranslocoService
): Promise<void> {
  const tpl = BOARD_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) return;

  for (const colKey of tpl.columns) {
    const name = i18n.translate(`boards.columns.${colKey}`);
    await columnService.createKanbanColumn(name, boardId);
  }
}
