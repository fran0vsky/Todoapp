import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TaskStatus } from './task.model';

@Component({
  selector: 'app-add-edit-task',
  templateUrl: './add-edit-task.component.html',
})
export class AddEditTaskComponent {
  @Input() title = '';
  @Input() description = '';
  @Input() status: TaskStatus = 'todo';
  @Input() showStatus = true;
  @Input() showLabels = true;
  @Input() submitLabel = 'Save';
  @Input() cancelLabel = 'Cancel';
  @Input() titlePlaceholder = 'Title...';
  @Input() descriptionPlaceholder = 'Description (optional)...';
  @Input() disableSubmit = false;

  @Output() titleChange = new EventEmitter<string>();
  @Output() descriptionChange = new EventEmitter<string>();
  @Output() statusChange = new EventEmitter<TaskStatus>();
  @Output() submitForm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  protected onTitleInput(event: Event): void {
    this.titleChange.emit((event.target as HTMLInputElement).value);
  }

  protected onDescriptionInput(event: Event): void {
    this.descriptionChange.emit((event.target as HTMLInputElement).value);
  }

  protected onStatusInput(event: Event): void {
    this.statusChange.emit((event.target as HTMLSelectElement).value as TaskStatus);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.submitForm.emit();
  }
}

