import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  SecurityContext,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { TaskStatus } from './task.model';

@Component({
  selector: 'app-add-edit-task',
  templateUrl: './add-edit-task.component.html',
  styles: [
    `
      .add-edit-rich-editor:empty::before {
        content: attr(data-placeholder);
        color: #737373;
        pointer-events: none;
      }
    `,
  ],
})
export class AddEditTaskComponent implements OnChanges, AfterViewInit {
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly TaskStatus = TaskStatus;

  @Input() title = '';
  @Input() description = '';
  /** Parent bumps on Clear so we re-apply model → view when signals skip unchanged values. */
  @Input() formResetCounter = 0;
  @Input() status: TaskStatus = TaskStatus.Todo;
  @Input() showStatus = true;
  @Input() showLabels = true;
  @Input() submitLabel = 'Save';
  @Input() clearLabel = 'Clear';
  @Input() titlePlaceholder = 'Title...';
  @Input() descriptionPlaceholder =
    'Description ex.: e.g. Wire the login form to POST /api/auth and surface validation errors in the UI';
  @Input() descriptionRequired = true;
  @Input() disableSubmit = false;
  /** When true, "Work in progress" cannot be selected (WIP column is full). */
  @Input() disableDoingStatus = false;
  /** Native `title` tooltip when Save is disabled (browser support varies on disabled controls). */
  @Input() saveDisabledHint = '';

  @Output() titleChange = new EventEmitter<string>();
  @Output() descriptionChange = new EventEmitter<string>();
  /** Not named `statusChange` — that pattern can interact badly with `[status]` on the host. */
  @Output() taskStatusChange = new EventEmitter<TaskStatus>();
  @Output() submitForm = new EventEmitter<void>();
  @Output() clear = new EventEmitter<void>();

  @ViewChild('descEditor') private descEditor?: ElementRef<HTMLDivElement>;
  @ViewChild('statusSelect') private statusSelect?: ElementRef<HTMLSelectElement>;

  /** Writable model for the status dropdown; `status` is one-way from parent, so ngModel must not bind to it alone. */
  protected selectedStatus = TaskStatus.Todo;

  private descEditorFocused = false;

  ngAfterViewInit(): void {
    queueMicrotask(() => {
      this.selectedStatus = this.status;
      this.syncStatusSelectDom();
      this.handleDescriptionInputChange();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['status']) {
      this.selectedStatus = this.status;
    }
    if (changes['description']) {
      queueMicrotask(() => this.handleDescriptionInputChange());
    }
    if (
      changes['formResetCounter'] &&
      !changes['formResetCounter'].firstChange
    ) {
      this.selectedStatus = this.status;
      queueMicrotask(() => this.handleDescriptionInputChange());
    }
    if (changes['status'] || (changes['formResetCounter'] && !changes['formResetCounter'].firstChange)) {
      queueMicrotask(() => this.syncStatusSelectDom());
    }
  }

  /** Native <select> value must match option value="" exactly; set element.value after model updates. */
  private syncStatusSelectDom(): void {
    const el = this.statusSelect?.nativeElement;
    if (!el) return;
    const v = this.selectedStatus;
    if (el.value !== v) {
      el.value = v;
    }
  }

  protected onTitleInput(event: Event): void {
    this.titleChange.emit((event.target as HTMLInputElement).value);
  }

  protected onRichInput(): void {
    const el = this.descEditor?.nativeElement;
    if (!el) return;
    this.descriptionChange.emit(this.serializeEditorHtml(el));
  }

  protected onRichFocus(): void {
    this.descEditorFocused = true;
  }

  protected onRichBlur(): void {
    this.descEditorFocused = false;
    this.handleDescriptionInputChange();
  }

  protected exec(cmd: 'bold' | 'italic' | 'underline' | 'insertUnorderedList'): void {
    document.execCommand(cmd, false);
    const el = this.descEditor?.nativeElement;
    if (el) {
      this.descriptionChange.emit(this.serializeEditorHtml(el));
    }
    el?.focus();
  }

  /** Native `change` + `HTMLSelectElement.value` — reliable string `todo` | `doing` | `done`. */
  protected onStatusSelectChange(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    const status = this.parseTaskStatus(raw);
    this.selectedStatus = status;
    this.taskStatusChange.emit(status);
  }

  private parseTaskStatus(raw: string): TaskStatus {
    if (raw === TaskStatus.Doing) return TaskStatus.Doing;
    if (raw === TaskStatus.Done) return TaskStatus.Done;
    return TaskStatus.Todo;
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (this.disableSubmit) {
      return;
    }
    this.submitForm.emit();
  }

  protected onClearClick(): void {
    this.descEditorFocused = false;
    this.descEditor?.nativeElement?.blur();
    this.clear.emit();
  }

  /** Apply parent `description` to the editor (e.g. Clear, open edit, or model sync). */
  private handleDescriptionInputChange(): void {
    const el = this.descEditor?.nativeElement;
    if (!el) return;
    const incoming = this.description ?? '';
    if (!incoming.trim()) {
      el.innerHTML = '';
      return;
    }
    const current = this.serializeEditorHtml(el);
    if (current === incoming) return;
    this.applyValueToEditor(el, incoming);
  }

  private applyValueToEditor(el: HTMLDivElement, value: string): void {
    const v = value ?? '';
    if (!v.trim()) {
      el.innerHTML = '';
      return;
    }
    if (!/<[a-z][\s\S]*>/i.test(v)) {
      el.textContent = v;
      return;
    }
    el.innerHTML = this.sanitizer.sanitize(SecurityContext.HTML, v) ?? '';
  }

  /** Normalize empty editor and return HTML string for the model. */
  private serializeEditorHtml(el: HTMLDivElement): string {
    const html = el.innerHTML.trim();
    if (!html || html === '<br>' || html === '<div><br></div>') {
      return '';
    }
    return html;
  }
}
