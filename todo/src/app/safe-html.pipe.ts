import { Pipe, PipeTransform, SecurityContext, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Renders stored description HTML safely for task cards (strips scripts etc.).
 */
@Pipe({
  name: 'safeHtml',
  standalone: true,
})
export class SafeHtmlPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    const raw = value?.trim() ? value : '';
    if (!raw) {
      return this.sanitizer.bypassSecurityTrustHtml(
        '<span class="opacity-40 select-none">&nbsp;</span>'
      );
    }
    // Plain text from older tasks: no tags — wrap as text-safe
    if (!/<[a-z][\s\S]*>/i.test(raw)) {
      const escaped = raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return this.sanitizer.bypassSecurityTrustHtml(
        `<span class="whitespace-pre-wrap">${escaped}</span>`
      );
    }
    const cleaned =
      this.sanitizer.sanitize(SecurityContext.HTML, raw) ?? '';
    return this.sanitizer.bypassSecurityTrustHtml(cleaned);
  }
}
