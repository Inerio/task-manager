import { Component, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { AlertComponent } from "./components/alert/alert.component";
import { ConfirmDialogComponent } from "./components/alert/confirm-dialog.component";
import { BoardComponent } from "./components/board/board.component";

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
  boards = [{ name: "Lorem Ipsum" }, { name: "Perso" }, { name: "Travail" }];
  selectedBoardIndex = 0;

  selectBoard(i: number) {
    this.selectedBoardIndex = i;
    // (plus tard : charger données spécifiques au board)
  }

  addBoard() {
    const name = prompt("Nom du nouveau board ?");
    if (name) this.boards.push({ name });
  }
}
