import { Component, signal, inject, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { AlertComponent } from "./components/alert/alert.component";
import { ConfirmDialogComponent } from "./components/alert/confirm-dialog.component";
import { BoardComponent } from "./components/board/board.component";
import { BoardService } from "./services/board.service";

@Component({
  selector: "app-root",
  standalone: true,
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
  imports: [
    CommonModule,
    AlertComponent,
    ConfirmDialogComponent,
    BoardComponent,
  ],
})
export class AppComponent {
  private readonly boardService = inject(BoardService);
  readonly boards = this.boardService.boards;
  selectedBoardId = signal<number | null>(null);

  constructor() {
    this.boardService.loadBoards();

    // Automatically select the first board after loading, if any
    computed(() => {
      const firstId = this.boards()[0]?.id;
      if (typeof firstId === "number" && this.selectedBoardId() === null) {
        this.selectedBoardId.set(firstId);
      }
    });
  }

  selectBoard(id: number | undefined) {
    if (typeof id === "number" && this.selectedBoardId() !== id) {
      this.selectedBoardId.set(id);
    }
  }

  addBoard() {
    const name = prompt("Enter the name of the new board:");
    if (name) {
      this.boardService.createBoard(name).subscribe({
        next: (board) => {
          this.boardService.loadBoards();
          setTimeout(() => {
            if (typeof board.id === "number") {
              this.selectedBoardId.set(board.id);
            }
          }, 300);
        },
      });
    }
  }

  get selectedBoardName(): string {
    const board = this.boards().find((b) => b.id === this.selectedBoardId());
    return board?.name ?? "No board selected";
  }
}
