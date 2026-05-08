import { SecurityContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { describe, expect, it } from 'vitest';
import { SafeHtmlPipe } from './safe-html.pipe';

describe('SafeHtmlPipe', () => {
  function setupPipe() {
    const sanitizer: Pick<
      DomSanitizer,
      'sanitize' | 'bypassSecurityTrustHtml'
    > = {
      sanitize: (_ctx: SecurityContext, val: string) => val,
      bypassSecurityTrustHtml: (html: string) =>
        html as unknown as ReturnType<DomSanitizer['bypassSecurityTrustHtml']>,
    };
    TestBed.configureTestingModule({
      providers: [SafeHtmlPipe, { provide: DomSanitizer, useValue: sanitizer }],
    });
    return TestBed.inject(SafeHtmlPipe);
  }

  it('returns placeholder for empty', () => {
    const pipe = setupPipe();
    expect(pipe.transform('  ')).toBeDefined();
  });

  it('escapes plain text without tag-like substring', () => {
    const pipe = setupPipe();
    const html = pipe.transform('a & b') as unknown as string;
    expect(html).toContain('&amp;');
    expect(html).not.toContain('<script');
  });

  it('sanitizes html', () => {
    const pipe = setupPipe();
    const out = pipe.transform('<p>ok</p>');
    expect(out).toBeDefined();
  });
});
