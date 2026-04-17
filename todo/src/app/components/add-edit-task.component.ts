import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SecurityContext,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { FIBONACCI_ESTIMATES, TaskStatus } from '../models/task.model';
import { SpeechRecognitionService } from '../services/speech-recognition.service';

@Component({
  selector: 'app-add-edit-task',
  templateUrl: './add-edit-task.component.html',
})
export class AddEditTaskComponent implements OnChanges, AfterViewInit, OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly speech = inject(SpeechRecognitionService);

  protected readonly TaskStatus = TaskStatus;
  protected readonly fibonacciEstimates = FIBONACCI_ESTIMATES;

  /** Combined label driving the mic button's tooltip/aria state. */
  protected readonly micLabel = computed(() => {
    switch (this.speech.state()) {
      case 'recording':
        return 'Stop recording';
      case 'requesting-permission':
        return 'Requesting microphone access…';
      case 'loading-model':
        return 'Loading speech model…';
      case 'processing':
        return 'Transcribing…';
      default:
        return 'Dictate description';
    }
  });

  /** Disable the button during non-interactive background work (model load, processing). */
  protected readonly micDisabled = computed(() => {
    const s = this.speech.state();
    return s === 'requesting-permission' || s === 'loading-model' || s === 'processing';
  });

  @Input() title = '';
  @Input() description = '';
  /** Parent bumps on Clear so we re-apply model → view when signals skip unchanged values. */
  @Input() formResetCounter = 0;
  @Input() status: TaskStatus = TaskStatus.Todo;
  /** Story points (Fibonacci); null = not set. */
  @Input() estimate: number | null = null;
  @Input() showStatus = true;
  @Input() showEstimate = true;
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
  @Output() estimateChange = new EventEmitter<number | null>();
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

  protected onEstimateChange(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    if (raw === '') {
      this.estimateChange.emit(null);
      return;
    }
    this.estimateChange.emit(Number(raw));
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
    this.speech.cancel();
    this.clear.emit();
  }

  /** Start or stop the Whisper-powered dictation depending on current recorder state. */
  protected async onMicClick(): Promise<void> {
    if (this.micDisabled()) return;
    const state = this.speech.state();
    if (state === 'recording') {
      const transcript = await this.speech.stopAndTranscribe();
      if (transcript) {
        this.appendTranscribedText(transcript);
      }
      return;
    }
    // Fresh start — clear any lingering error banner so the UI resets.
    if (state === 'error') this.speech.clearError();
    await this.speech.start();
  }

  ngOnDestroy(): void {
    // Abort any in-flight recording if the form is torn down mid-session.
    this.speech.cancel();
  }

  /**
   * Append transcribed plain text at the end of the rich editor, preserving any existing HTML
   * formatting. Inserts a separating space if the previous content doesn't already end in whitespace.
   */
  private appendTranscribedText(text: string): void {
    const el = this.descEditor?.nativeElement;
    if (!el) return;
    const existing = el.textContent ?? '';
    const needsSeparator = existing.trim().length > 0 && !/\s$/.test(existing);
    el.appendChild(document.createTextNode(needsSeparator ? ` ${text}` : text));
    this.descriptionChange.emit(this.serializeEditorHtml(el));
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
