import { describe, expect, it } from 'vitest';
import { absolutizeHtmlUrls, stripHtml, stripHtmlPreservingParagraphs } from '../../src/utils/html.js';

describe('stripHtml', () => {
  it('removes HTML tags', () => {
    expect(stripHtml('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('decodes common named entities', () => {
    expect(stripHtml('Tom &amp; Jerry &mdash; a &quot;classic&quot;')).toBe('Tom & Jerry — a "classic"');
  });

  it('decodes numeric and hex entities', () => {
    expect(stripHtml('&#8217;tis &#x2764;')).toBe('’tis ❤');
  });

  it('collapses repeated whitespace produced by stripped tags', () => {
    expect(stripHtml('<p>Line one</p>\n<p>Line two</p>')).toBe('Line one Line two');
  });

  it('returns an empty string for empty input', () => {
    expect(stripHtml('')).toBe('');
  });
});

describe('stripHtmlPreservingParagraphs', () => {
  it('turns paragraph and block boundaries into blank lines', () => {
    expect(stripHtmlPreservingParagraphs('<p>First.</p><p>Second.</p>')).toBe('First.\n\nSecond.');
  });

  it('treats <br> as a paragraph break', () => {
    expect(stripHtmlPreservingParagraphs('Line one<br>Line two')).toBe('Line one\n\nLine two');
  });

  it('collapses intra-paragraph whitespace without touching paragraph breaks', () => {
    expect(stripHtmlPreservingParagraphs('<p>Too   many   spaces.</p><p>Next.</p>')).toBe('Too many spaces.\n\nNext.');
  });

  it('decodes entities the same way stripHtml does', () => {
    expect(stripHtmlPreservingParagraphs('<p>Tom &amp; Jerry</p>')).toBe('Tom & Jerry');
  });
});

describe('absolutizeHtmlUrls', () => {
  const baseUrl = 'https://example.com';

  it('rewrites a site-relative href to an absolute URL', () => {
    expect(absolutizeHtmlUrls('<a href="/pricing">Pricing</a>', baseUrl)).toBe(
      '<a href="https://example.com/pricing">Pricing</a>',
    );
  });

  it('rewrites a site-relative img src to an absolute URL', () => {
    expect(absolutizeHtmlUrls('<img src="/img/a.png">', baseUrl)).toBe('<img src="https://example.com/img/a.png">');
  });

  it('leaves already-absolute URLs unchanged', () => {
    expect(absolutizeHtmlUrls('<a href="https://other.com/x">x</a>', baseUrl)).toBe(
      '<a href="https://other.com/x">x</a>',
    );
  });

  it('leaves mailto, tel, and data URIs unchanged', () => {
    expect(absolutizeHtmlUrls('<a href="mailto:a@b.com">mail</a>', baseUrl)).toBe('<a href="mailto:a@b.com">mail</a>');
    expect(absolutizeHtmlUrls('<img src="data:image/png;base64,AAA">', baseUrl)).toBe(
      '<img src="data:image/png;base64,AAA">',
    );
  });
});
