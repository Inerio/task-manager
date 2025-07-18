export interface KanbanColumn {
  id?: number;
  boardId: number; // <-- à ajouter
  name: string;
  position?: number;
}
