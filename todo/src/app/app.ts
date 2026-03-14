import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  imports: [FormsModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'todo';
  protected newTaskText = '';
  protected tasks: { id: number; text: string }[] = [];
  protected editingId: number | null = null;
  protected editText = '';
  private nextId = 1;

  protected addTask(): void {
    const text = this.newTaskText.trim();
    if (!text) return;
    this.tasks.push({ id: this.nextId++, text });
    this.newTaskText = '';
  }

  protected removeTask(id: number): void {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    if (this.editingId === id) {
      this.editingId = null;
      this.editText = '';
    }
  }

  protected startEdit(task: { id: number; text: string }): void {
    this.editingId = task.id;
    this.editText = task.text;
  }

  protected saveEdit(): void {
    if (this.editingId == null) return;
    const t = this.tasks.find((x) => x.id === this.editingId);
    if (t) t.text = this.editText.trim() || t.text;
    this.editingId = null;
    this.editText = '';
  }

  protected cancelEdit(): void {
    this.editingId = null;
    this.editText = '';
  }
}
