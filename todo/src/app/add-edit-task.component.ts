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
  signal,
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
  /** Shown as native tooltip when Save is inactive (uses aria-disabled so hover works). */
  @Input() saveDisabledHint = '';
  /** Short headline for the validation banner (e.g. "Description required!"). */
  @Input() saveBlockedAlertTitle = '';

  @Output() titleChange = new EventEmitter<string>();
  @Output() descriptionChange = new EventEmitter<string>();
  @Output() statusChange = new EventEmitter<TaskStatus>();
  @Output() submitForm = new EventEmitter<void>();
  @Output() clear = new EventEmitter<void>();

  @ViewChild('descEditor') private descEditor?: ElementRef<HTMLDivElement>;

  private descEditorFocused = false;

  /** Shown after user tries to save while invalid. */
  protected readonly submitBlockedBanner = signal<{
    headline: string;
    detail: string | null;
  } | null>(null);

  ngAfterViewInit(): void {
    queueMicrotask(() => this.handleDescriptionInputChange());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['description']) {
      queueMicrotask(() => this.handleDescriptionInputChange());
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

  protected onStatusInput(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (
      value === TaskStatus.Todo ||
      value === TaskStatus.Doing ||
      value === TaskStatus.Done
    ) {
      this.statusChange.emit(value);
    }
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (this.disableSubmit) {
      this.showSubmitBlockedBanner();
      return;
    }
    this.submitBlockedBanner.set(null);
    this.submitForm.emit();
  }

  protected onClearClick(): void {
    this.submitBlockedBanner.set(null);
    this.clear.emit();
  }

  private showSubmitBlockedBanner(): void {
    const headline =
      this.saveBlockedAlertTitle.trim() || "Can't save yet";
    const detailRaw = (this.saveDisabledHint || '').trim();
    const detail =
      detailRaw.length > 0 && detailRaw !== headline ? detailRaw : null;
    this.submitBlockedBanner.set({ headline, detail });
  }

  /** Apply parent `description` to the editor; always clear when parent sends empty (e.g. Clear). */
  private handleDescriptionInputChange(): void {
    const el = this.descEditor?.nativeElement;
    if (!el) return;
    const incoming = this.description ?? '';
    if (!incoming.trim()) {
      el.innerHTML = '';
      return;
    }
    if (this.descEditorFocused) return;
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
