import { Injectable, computed, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { TaskList } from "../models/task-list.model";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment.local";

@Injectable({ providedIn: "root" })
export class TaskListService {
  private readonly apiUrl = environment.apiUrlLists;
  private readonly _lists = signal<TaskList[]>([]);
  readonly lists = computed(() => this._lists());
  private readonly _loading = signal(false);
  readonly loading = computed(() => this._loading());

  constructor(private http: HttpClient) {}

  loadLists(): void {
    this._loading.set(true);
    this.http.get<TaskList[]>(this.apiUrl).subscribe({
      next: (data) => this._lists.set(data ?? []),
      error: () => this._lists.set([]),
      complete: () => this._loading.set(false),
    });
  }

  createList(name: string): Observable<TaskList> {
    return this.http.post<TaskList>(this.apiUrl, { name });
  }

  updateList(list: TaskList): Observable<TaskList> {
    if (!list.id) throw new Error("TaskList ID required");
    return this.http.put<TaskList>(`${this.apiUrl}/${list.id}`, list);
  }

  /** Supprime une liste et MAJ le signal sans reload */
  deleteList(listId: number): Observable<void> {
    return new Observable<void>((observer) => {
      this.http.delete<void>(`${this.apiUrl}/${listId}`).subscribe({
        next: () => {
          this._lists.set(this._lists().filter((l) => l.id !== listId));
          observer.next();
          observer.complete();
        },
        error: (err) => observer.error(err),
      });
    });
  }
}
