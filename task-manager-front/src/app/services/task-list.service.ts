import { Injectable, computed, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { TaskList } from "../models/task-list.model";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment.local";

@Injectable({ providedIn: "root" })
export class TaskListService {
  // ------------------------------------------
  // API URL (from environment)
  // ------------------------------------------
  private readonly apiUrl = environment.apiUrlLists;

  // ------------------------------------------
  // STATE SIGNALS
  // ------------------------------------------
  private readonly _lists = signal<TaskList[]>([]);
  readonly lists = computed(() => this._lists());

  private readonly _loading = signal(false);
  readonly loading = computed(() => this._loading());

  // ------------------------------------------
  // CONSTRUCTOR & DEPENDENCIES
  // ------------------------------------------
  constructor(private http: HttpClient) {}

  // ------------------------------------------
  // LOAD ALL LISTS (ordered by position from backend)
  // ------------------------------------------
  loadLists(): void {
    this._loading.set(true);
    this.http.get<TaskList[]>(this.apiUrl).subscribe({
      next: (data) => {
        // The backend already returns lists ordered by position
        this._lists.set(data ?? []);
      },
      error: () => this._lists.set([]),
      complete: () => this._loading.set(false),
    });
  }

  // ------------------------------------------
  // CREATE A NEW LIST (position handled by backend)
  // ------------------------------------------
  createList(name: string): Observable<TaskList> {
    // Only name needed; backend assigns position
    return this.http.post<TaskList>(this.apiUrl, { name });
  }

  // ------------------------------------------
  // UPDATE A LIST (update name and/or position)
  // ------------------------------------------
  updateList(list: TaskList): Observable<TaskList> {
    if (!list.id) throw new Error("TaskList ID required");
    // Backend can update both name and position
    return this.http.put<TaskList>(`${this.apiUrl}/${list.id}`, list);
  }

  // ------------------------------------------
  // DELETE A LIST (and update signal without reload)
  // ------------------------------------------
  deleteList(listId: number): Observable<void> {
    return new Observable<void>((observer) => {
      this.http.delete<void>(`${this.apiUrl}/${listId}`).subscribe({
        next: () => {
          // Remove the list from local signal
          this._lists.set(this._lists().filter((l) => l.id !== listId));
          observer.next();
          observer.complete();
        },
        error: (err) => observer.error(err),
      });
    });
  }
}
